import { useState, useEffect, useRef, useCallback } from 'react';
import { saveRTCData, subscribeToRTCData } from '../services/room';
import type { RTCConnectionData } from '../services/room/types';

interface UseWebRTCProps {
    roomId: string;
    userId: string;
    otherPlayerId: string | null;
    isHost: boolean;
    bothPlayersReady: boolean;
    shouldStartConnection: boolean;
}

interface UseWebRTCReturn {
    isConnected: boolean;
    connectionError: string | null;
    dataChannel: React.RefObject<RTCDataChannel | null>;
    sendMessage: (message: object) => boolean;
    resetConnection: () => void;
    connectionState: 'idle' | 'initializing' | 'connecting' | 'connected' | 'failed';
}

export const useWebRTC = ({
    roomId,
    userId,
    otherPlayerId,
    isHost,
    bothPlayersReady,
    shouldStartConnection
}: UseWebRTCProps): UseWebRTCReturn => {
    const [isConnected, setIsConnected] = useState(false);
    const [connectionError, setConnectionError] = useState<string | null>(null);
    const [connectionState, setConnectionState] = useState<'idle' | 'initializing' | 'connecting' | 'connected' | 'failed'>('idle');

    const peerConnection = useRef<RTCPeerConnection | null>(null);
    const dataChannel = useRef<RTCDataChannel | null>(null);
    const rtcInitialized = useRef<boolean>(false);
    const iceCandidateQueue = useRef<RTCIceCandidate[]>([]);
    const retryCount = useRef<number>(0);
    const maxRetries = 3;

    const initializationDelay = useRef<NodeJS.Timeout | null>(null);
    const connectionTimeout = useRef<NodeJS.Timeout | null>(null);

    // ICE設定
    const iceServers = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
    ];

    const sendMessage = useCallback((message: object): boolean => {
        if (dataChannel.current?.readyState === 'open') {
            try {
                dataChannel.current.send(JSON.stringify({
                    ...message,
                    timestamp: Date.now()
                }));
                return true;
            } catch (err) {
                console.error("Error sending message:", err);
                return false;
            }
        }
        return false;
    }, []);

    const resetConnection = useCallback(() => {
        console.log("Resetting WebRTC connection");
        if (initializationDelay.current) {
            clearTimeout(initializationDelay.current);
            initializationDelay.current = null;
        }

        if (connectionTimeout.current) {
            clearTimeout(connectionTimeout.current);
            connectionTimeout.current = null;
        }

        // 既存の接続をクリーンアップ
        if (peerConnection.current) {
            peerConnection.current.close();
            peerConnection.current = null;
        }

        if (dataChannel.current) {
            dataChannel.current.close();
            dataChannel.current = null;
        }

        setConnectionError(null);
        setIsConnected(false);
        setConnectionState('idle');
        rtcInitialized.current = false;
        iceCandidateQueue.current = [];
        retryCount.current++;

        if (retryCount.current >= maxRetries) {
            setConnectionError("接続の再試行回数が上限に達しました。ページを再読み込みしてください。");
            setConnectionState('failed');
            return;
        }

        setTimeout(() => {
            console.log(`準備完了後に再接続を試行します (attempt ${retryCount.current + 1}/${maxRetries})`);
            setConnectionState('idle');
            rtcInitialized.current = false;
        }, 3000);
    }, []);

    // ICE候補をキューに追加する関数
    const addIceCandidateToQueue = useCallback((candidate: RTCIceCandidate) => {
        if (peerConnection.current?.remoteDescription) {
            peerConnection.current.addIceCandidate(candidate).catch(err => {
                console.warn("Error adding ICE candidate:", err);
            });
        } else {
            iceCandidateQueue.current.push(candidate);
            console.log(`ICE candidate queued (total: ${iceCandidateQueue.current.length})`);
        }
    }, []);

    // キューに溜まったICE候補を処理する関数
    const processQueuedIceCandidates = useCallback(async () => {
        if (!peerConnection.current?.remoteDescription || iceCandidateQueue.current.length === 0) {
            return;
        }

        console.log(`Processing ${iceCandidateQueue.current.length} queued ICE candidates`);

        for (const candidate of iceCandidateQueue.current) {
            try {
                await peerConnection.current.addIceCandidate(candidate);
            } catch (err) {
                console.warn("Error adding queued ICE candidate:", err);
            }
        }
        iceCandidateQueue.current = [];
    }, []);

    // WebRTC初期化の実行
    const initializeWebRTC = useCallback(async () => {
        if (rtcInitialized.current || !otherPlayerId) {
            console.log("WebRTC initialization skipped:", rtcInitialized.current ? "already initialized" : "no other player");
            return;
        }

        console.log(`Starting WebRTC initialization as ${isHost ? 'HOST' : 'GUEST'} with player:`, otherPlayerId);

        setConnectionState('initializing');
        setConnectionError(null);
        rtcInitialized.current = true;
        iceCandidateQueue.current = [];

        try {
            // WebRTC接続の設定
            const pc = new RTCPeerConnection({
                iceServers,
                iceCandidatePoolSize: 10,
                iceTransportPolicy: 'all',
                bundlePolicy: 'max-bundle',
                rtcpMuxPolicy: 'require'
            });
            peerConnection.current = pc;

            console.log("RTCPeerConnection created successfully");

            // 接続状態の詳細な監視
            pc.oniceconnectionstatechange = () => {
                console.log("ICE connection state:", pc.iceConnectionState);

                switch (pc.iceConnectionState) {
                    case 'checking':
                        setConnectionState('connecting');
                        break;
                    case 'connected':
                    case 'completed':
                        setIsConnected(true);
                        setConnectionError(null);
                        setConnectionState('connected');
                        retryCount.current = 0;
                        if (connectionTimeout.current) {
                            clearTimeout(connectionTimeout.current);
                            connectionTimeout.current = null;
                        }
                        break;
                    case 'failed':
                        setIsConnected(false);
                        setConnectionError(`ICE接続が失敗しました`);
                        setConnectionState('failed');
                        break;
                    case 'disconnected':
                        setIsConnected(false);
                        setTimeout(() => {
                            if (pc.iceConnectionState === 'disconnected') {
                                setConnectionError("接続が切断されました");
                                setConnectionState('failed');
                            }
                        }, 5000);
                        break;
                    case 'closed':
                        setIsConnected(false);
                        setConnectionState('idle');
                        break;
                }
            };

            pc.onconnectionstatechange = () => {
                console.log(" Connection state:", pc.connectionState);
            };

            // ICE候補の処理
            pc.onicecandidate = async (event) => {
                if (event.candidate) {
                    console.log(" ICE candidate generated:", event.candidate.type);

                    try {
                        let currentData: RTCConnectionData = { candidates: [] };

                        const localDesc = pc.localDescription;
                        if (localDesc) {
                            const serializedDesc = {
                                type: localDesc.type,
                                sdp: localDesc.sdp
                            };

                            if (isHost) {
                                currentData.offer = serializedDesc;
                            } else {
                                currentData.answer = serializedDesc;
                            }
                        }

                        const serializedCandidate = {
                            candidate: event.candidate.candidate,
                            sdpMid: event.candidate.sdpMid,
                            sdpMLineIndex: event.candidate.sdpMLineIndex,
                            usernameFragment: event.candidate.usernameFragment
                        };

                        currentData.candidates = [serializedCandidate];
                        await saveRTCData(roomId, userId, currentData);
                    } catch (error) {
                        console.error(" Error saving ICE candidate:", error);
                    }
                } else {
                    console.log(" ICE gathering complete");
                }
            };

            // 接続タイムアウト設定
            connectionTimeout.current = setTimeout(() => {
                if (connectionState !== 'connected') {
                    console.log("Connection timeout, triggering reset");
                    resetConnection();
                }
            }, 30000);

            const handleChannelOpen = () => {
                console.log('Data channel opened successfully');
                setIsConnected(true);
                setConnectionError(null);
                setConnectionState('connected');
                retryCount.current = 0;

                if (connectionTimeout.current) {
                    clearTimeout(connectionTimeout.current);
                    connectionTimeout.current = null;
                }

                // 接続成功を通知
                sendMessage({
                    type: 'connected',
                    userId
                });
            };

            const handleChannelClose = () => {
                console.log('Data channel closed');
                setIsConnected(false);
                setConnectionState('idle');
            };

            const handleChannelError = (error: Event) => {
                console.error('Data channel error:', error);
                setConnectionError("データチャネルでエラーが発生しました");
                setConnectionState('failed');
            };

            if (isHost) {
                console.log("Setting up HOST role");

                // ホスト側はデータチャネルを作成
                const channel = pc.createDataChannel('game', {
                    ordered: true,
                    maxRetransmits: 3
                });
                dataChannel.current = channel;

                channel.onopen = handleChannelOpen;
                channel.onclose = handleChannelClose;
                channel.onerror = handleChannelError;

                // オファーを作成
                const offer = await pc.createOffer({
                    offerToReceiveAudio: false,
                    offerToReceiveVideo: false
                });
                await pc.setLocalDescription(offer);
                console.log("Offer created and set as local description");

                await new Promise(resolve => setTimeout(resolve, 2000));

                const finalOffer = pc.localDescription;
                if (finalOffer) {
                    const serializedOffer = {
                        type: finalOffer.type,
                        sdp: finalOffer.sdp || ''
                    };

                    await saveRTCData(roomId, userId, {
                        offer: serializedOffer,
                        candidates: []
                    });
                    console.log("Offer saved successfully");
                }
            } else {
                console.log(" Setting up GUEST role");

                // ゲスト側はデータチャネルを受信
                pc.ondatachannel = (event) => {
                    const channel = event.channel;
                    dataChannel.current = channel;

                    console.log("📡 Data channel received by guest");

                    channel.onopen = handleChannelOpen;
                    channel.onclose = handleChannelClose;
                    channel.onerror = handleChannelError;
                };
            }

            setConnectionState('connecting');
        } catch (error) {
            console.error("Error initializing WebRTC:", error);
            setConnectionError("WebRTC接続の初期化に失敗しました");
            setConnectionState('failed');
            rtcInitialized.current = false;
        }
    }, [roomId, userId, otherPlayerId, isHost, sendMessage, resetConnection, connectionState]);

    useEffect(() => {
        const cleanup = () => {
            if (initializationDelay.current) {
                clearTimeout(initializationDelay.current);
                initializationDelay.current = null;
            }
        };

        // 初期化の条件をチェック
        const shouldInitialize =
            roomId &&
            otherPlayerId &&
            shouldStartConnection &&
            bothPlayersReady &&
            !rtcInitialized.current &&
            (connectionState === 'idle' || connectionState === 'failed');

        if (!shouldInitialize) {
            const reason =
                !roomId ? "no roomId" :
                    !otherPlayerId ? "no other player" :
                        !shouldStartConnection ? "connection not requested" :
                            !bothPlayersReady ? "players not ready" :
                                rtcInitialized.current ? "already initialized" :
                                    connectionState !== 'idle' ? `state is ${connectionState}` :
                                        "unknown";

            console.log(`Skipping WebRTC initialization: ${reason}`);
            cleanup();
            return cleanup;
        }

        console.log(`Scheduling WebRTC initialization in ${isHost ? '1000' : '2000'}ms`);

        // ホストとゲストで初期化タイミングをずらす
        const delay = isHost ? 1000 : 2000;

        initializationDelay.current = setTimeout(() => {
            console.log(`Starting WebRTC initialization (${isHost ? 'HOST' : 'GUEST'})`);
            initializeWebRTC();
        }, delay);

        return cleanup;
    }, [
        roomId,
        otherPlayerId,
        shouldStartConnection,
        bothPlayersReady,
        isHost,
        connectionState,
        initializeWebRTC
    ]);

    // 相手のWebRTC接続情報を監視
    useEffect(() => {
        if (!otherPlayerId || !roomId) {
            return;
        }

        console.log("👂 Subscribing to RTC data for:", otherPlayerId);

        const unsubscribeRTC = subscribeToRTCData(roomId, otherPlayerId, async (data) => {
            if (!data || !peerConnection.current) {
                return;
            }

            console.log(" RTC data received:", Object.keys(data));

            try {
                const pc = peerConnection.current;

                if (isHost && data.answer) {
                    console.log("Host processing answer, signaling state:", pc.signalingState);

                    if (pc.signalingState === 'have-local-offer') {
                        await pc.setRemoteDescription({
                            type: data.answer.type as RTCSdpType,
                            sdp: data.answer.sdp
                        });
                        console.log(" Remote description (answer) set successfully");

                        await processQueuedIceCandidates();
                    }
                } else if (!isHost && data.offer) {
                    console.log("Guest processing offer, signaling state:", pc.signalingState);

                    if (pc.signalingState === 'stable') {
                        await pc.setRemoteDescription({
                            type: data.offer.type as RTCSdpType,
                            sdp: data.offer.sdp
                        });
                        console.log("Remote description (offer) set successfully");

                        await processQueuedIceCandidates();

                        const answer = await pc.createAnswer();
                        await pc.setLocalDescription(answer);
                        console.log("📤 Answer created and set as local description");

                        await new Promise(resolve => setTimeout(resolve, 1000));

                        const finalAnswer = pc.localDescription;
                        if (finalAnswer) {
                            const serializedAnswer = {
                                type: finalAnswer.type,
                                sdp: finalAnswer.sdp || ''
                            };

                            await saveRTCData(roomId, userId, {
                                answer: serializedAnswer,
                                candidates: []
                            });
                            console.log(" Answer saved successfully");
                        }
                    }
                }

                // ICE candidateを処理
                if (data.candidates && data.candidates.length > 0) {
                    for (const candidateData of data.candidates) {
                        if (!candidateData) continue;

                        try {
                            const candidate = new RTCIceCandidate(candidateData);
                            addIceCandidateToQueue(candidate);
                        } catch (icErr) {
                            console.warn(" Error processing ICE candidate:", icErr);
                        }
                    }
                }
            } catch (error) {
                console.error("Error handling RTC data:", error);
                setConnectionError("WebRTC接続データの処理に失敗しました");
                setConnectionState('failed');
            }
        });

        return unsubscribeRTC;
    }, [roomId, otherPlayerId, isHost, addIceCandidateToQueue, processQueuedIceCandidates, userId]);

    // クリーンアップ
    useEffect(() => {
        return () => {
            console.log("🧹 Cleaning up WebRTC connection");

            if (initializationDelay.current) {
                clearTimeout(initializationDelay.current);
            }

            if (connectionTimeout.current) {
                clearTimeout(connectionTimeout.current);
            }

            if (peerConnection.current) {
                peerConnection.current.close();
                peerConnection.current = null;
            }

            if (dataChannel.current) {
                dataChannel.current.close();
                dataChannel.current = null;
            }

            rtcInitialized.current = false;
            iceCandidateQueue.current = [];
        };
    }, []);

    return {
        isConnected,
        connectionError,
        dataChannel,
        sendMessage,
        resetConnection,
        connectionState
    };
};
