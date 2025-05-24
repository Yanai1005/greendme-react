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
    const maxRetries = 5;

    const signalingState = useRef<'idle' | 'creating-offer' | 'waiting-answer' | 'processing-offer' | 'connected'>('idle');
    const remoteDescriptionSet = useRef<boolean>(false);

    const initializationDelay = useRef<NodeJS.Timeout | null>(null);
    const connectionTimeout = useRef<NodeJS.Timeout | null>(null);

    const iceServers = [
        // STUN servers
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
        // TURN server
        {
            urls: 'turn:relay.backups.cz',
            username: 'webrtc',
            credential: 'webrtc'
        },
        {
            urls: 'turn:relay.backups.cz?transport=tcp',
            username: 'webrtc',
            credential: 'webrtc'
        }
    ];

    // メッセージ送信ユーティリティ
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
        console.log("Performing complete WebRTC reset");

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
        signalingState.current = 'idle';
        remoteDescriptionSet.current = false;
        retryCount.current++;

        if (retryCount.current >= maxRetries) {
            setConnectionError(`接続に${maxRetries}回失敗しました。ネットワーク環境を確認してページを再読み込みしてください。`);
            setConnectionState('failed');
            return;
        }

        const backoffTime = Math.min(3000 * Math.pow(1.5, retryCount.current), 15000);
        console.log(` Scheduling retry ${retryCount.current}/${maxRetries} in ${backoffTime}ms`);

        setTimeout(() => {
            console.log(` Retry attempt ${retryCount.current}/${maxRetries}`);
            setConnectionState('idle');
            rtcInitialized.current = false;
        }, backoffTime);
    }, []);

    const addIceCandidateToQueue = useCallback((candidate: RTCIceCandidate) => {
        if (peerConnection.current?.remoteDescription && remoteDescriptionSet.current) {
            peerConnection.current.addIceCandidate(candidate).catch(err => {
                console.warn(" Error adding ICE candidate:", err);
            });
        } else {
            iceCandidateQueue.current.push(candidate);
            console.log(`ICE candidate queued (total: ${iceCandidateQueue.current.length})`);
        }
    }, []);

    const processQueuedIceCandidates = useCallback(async () => {
        if (!peerConnection.current?.remoteDescription || !remoteDescriptionSet.current || iceCandidateQueue.current.length === 0) {
            return;
        }

        console.log(` Processing ${iceCandidateQueue.current.length} queued ICE candidates`);

        for (const candidate of iceCandidateQueue.current) {
            try {
                await peerConnection.current.addIceCandidate(candidate);
                console.log("ICE candidate added successfully");
            } catch (err) {
                console.warn(" Error adding queued ICE candidate:", err);
            }
        }
        iceCandidateQueue.current = [];
    }, []);

    // WebRTC初期化
    const initializeWebRTC = useCallback(async () => {
        if (rtcInitialized.current || !otherPlayerId) {
            console.log(" WebRTC initialization skipped:", rtcInitialized.current ? "already initialized" : "no other player");
            return;
        }

        console.log(` Starting WebRTC initialization as ${isHost ? 'HOST' : 'GUEST'} (attempt ${retryCount.current + 1}/${maxRetries})`);

        setConnectionState('initializing');
        setConnectionError(null);
        rtcInitialized.current = true;
        iceCandidateQueue.current = [];
        signalingState.current = 'idle';
        remoteDescriptionSet.current = false;

        try {
            const pc = new RTCPeerConnection({
                iceServers,
                iceCandidatePoolSize: 10,
                iceTransportPolicy: 'all',
                bundlePolicy: 'max-bundle',
                rtcpMuxPolicy: 'require'
            });
            peerConnection.current = pc;

            console.log(" RTCPeerConnection created with enhanced configuration");

            // 詳細な接続状態監視
            pc.oniceconnectionstatechange = () => {
                console.log(`ICE connection state: ${pc.iceConnectionState}`);

                switch (pc.iceConnectionState) {
                    case 'checking':
                        setConnectionState('connecting');
                        break;
                    case 'connected':
                    case 'completed':
                        setIsConnected(true);
                        setConnectionError(null);
                        setConnectionState('connected');
                        signalingState.current = 'connected';
                        retryCount.current = 0;
                        if (connectionTimeout.current) {
                            clearTimeout(connectionTimeout.current);
                            connectionTimeout.current = null;
                        }
                        console.log(" WebRTC connection established successfully!");
                        break;
                    case 'failed':
                        console.log(" ICE connection failed, triggering reset");
                        setIsConnected(false);
                        setConnectionError(`ICE接続失敗 (試行 ${retryCount.current + 1}/${maxRetries})`);
                        setConnectionState('failed');
                        setTimeout(() => {
                            if (retryCount.current < maxRetries) {
                                resetConnection();
                            }
                        }, 2000);
                        break;
                    case 'disconnected':
                        setIsConnected(false);
                        setTimeout(() => {
                            if (pc.iceConnectionState === 'disconnected') {
                                console.log("🔌 Connection lost, attempting to reconnect");
                                resetConnection();
                            }
                        }, 8000);
                        break;
                    case 'closed':
                        setIsConnected(false);
                        setConnectionState('idle');
                        break;
                }
            };

            pc.onconnectionstatechange = () => {
                console.log(`Connection state: ${pc.connectionState}`);
            };

            pc.onicegatheringstatechange = () => {
                console.log(` ICE gathering state: ${pc.iceGatheringState}`);
            };

            // ICE候補の処理
            pc.onicecandidate = async (event) => {
                if (event.candidate) {
                    console.log(` New ICE candidate: ${event.candidate.type} (${event.candidate.protocol})`);

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
                    console.log(" ICE gathering completed");
                }
            };

            connectionTimeout.current = setTimeout(() => {
                if (connectionState !== 'connected') {
                    console.log(" Connection timeout, triggering reset");
                    resetConnection();
                }
            }, 60000);

            const handleChannelOpen = () => {
                console.log(' Data channel opened successfully');
                setIsConnected(true);
                setConnectionError(null);
                setConnectionState('connected');
                retryCount.current = 0;

                if (connectionTimeout.current) {
                    clearTimeout(connectionTimeout.current);
                    connectionTimeout.current = null;
                }

                sendMessage({
                    type: 'connected',
                    userId
                });
            };

            const handleChannelClose = () => {
                console.log(' Data channel closed');
                setIsConnected(false);
                setConnectionState('idle');
            };

            const handleChannelError = (error: Event) => {
                console.error(' Data channel error:', error);
                setConnectionError("データチャネルエラーが発生しました");
                setConnectionState('failed');
            };

            if (isHost) {
                console.log(" Setting up HOST role with delayed offer creation");

                const channel = pc.createDataChannel('game', {
                    ordered: true,
                    maxRetransmits: 3
                });
                dataChannel.current = channel;

                channel.onopen = handleChannelOpen;
                channel.onclose = handleChannelClose;
                channel.onerror = handleChannelError;

                signalingState.current = 'creating-offer';
                const offer = await pc.createOffer({
                    offerToReceiveAudio: false,
                    offerToReceiveVideo: false
                });
                await pc.setLocalDescription(offer);
                console.log("📤 Offer created and set as local description");

                await new Promise<void>((resolve) => {
                    const maxWaitTime = 10000;
                    const startTime = Date.now();

                    const checkGathering = () => {
                        if (pc.iceGatheringState === 'complete' || Date.now() - startTime > maxWaitTime) {
                            resolve();
                        } else {
                            setTimeout(checkGathering, 500);
                        }
                    };

                    if (pc.iceGatheringState === 'complete') {
                        resolve();
                    } else {
                        pc.addEventListener('icegatheringstatechange', () => {
                            if (pc.iceGatheringState === 'complete') {
                                resolve();
                            }
                        }, { once: true });
                        checkGathering();
                    }
                });

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

                    signalingState.current = 'waiting-answer';
                    console.log(" Offer saved, waiting for answer");
                }
            } else {
                console.log("Setting up GUEST role");

                // ゲスト側の処理
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
            console.error(" Error initializing WebRTC:", error);
            setConnectionError("WebRTC初期化に失敗しました");
            setConnectionState('failed');
            rtcInitialized.current = false;
            setTimeout(() => resetConnection(), 3000);
        }
    }, [roomId, userId, otherPlayerId, isHost, sendMessage, resetConnection, connectionState]);

    useEffect(() => {
        const cleanup = () => {
            if (initializationDelay.current) {
                clearTimeout(initializationDelay.current);
                initializationDelay.current = null;
            }
        };

        const shouldInitialize =
            roomId &&
            otherPlayerId &&
            shouldStartConnection &&
            bothPlayersReady &&
            !rtcInitialized.current &&
            (connectionState === 'idle' || connectionState === 'failed');

        if (!shouldInitialize) {
            cleanup();
            return cleanup;
        }

        console.log(` Scheduling WebRTC initialization in ${isHost ? '2000' : '4000'}ms`);

        const delay = isHost ? 2000 : 4000;

        initializationDelay.current = setTimeout(() => {
            console.log(` Starting WebRTC initialization (${isHost ? 'HOST' : 'GUEST'})`);
            initializeWebRTC();
        }, delay);

        return cleanup;
    }, [roomId, otherPlayerId, shouldStartConnection, bothPlayersReady, isHost, connectionState, initializeWebRTC]);

    useEffect(() => {
        if (!otherPlayerId || !roomId) {
            return;
        }

        console.log(" Subscribing to RTC data for:", otherPlayerId);

        const unsubscribeRTC = subscribeToRTCData(roomId, otherPlayerId, async (data) => {
            if (!data || !peerConnection.current) {
                return;
            }

            console.log(" RTC data received:", Object.keys(data), "Signaling state:", peerConnection.current.signalingState);

            try {
                const pc = peerConnection.current;

                if (isHost && data.answer && signalingState.current === 'waiting-answer') {
                    console.log(" Host processing answer");

                    if (pc.signalingState === 'have-local-offer') {
                        await pc.setRemoteDescription({
                            type: data.answer.type as RTCSdpType,
                            sdp: data.answer.sdp
                        });
                        remoteDescriptionSet.current = true;
                        signalingState.current = 'connected';
                        console.log(" Remote description (answer) set successfully");

                        await processQueuedIceCandidates();
                    } else {
                        console.warn(`Skipping answer processing, wrong signaling state: ${pc.signalingState}`);
                    }
                } else if (!isHost && data.offer && signalingState.current === 'idle') {
                    console.log(" Guest processing offer");

                    if (pc.signalingState === 'stable') {
                        signalingState.current = 'processing-offer';

                        await pc.setRemoteDescription({
                            type: data.offer.type as RTCSdpType,
                            sdp: data.offer.sdp
                        });
                        remoteDescriptionSet.current = true;
                        console.log(" Remote description (offer) set successfully");

                        await processQueuedIceCandidates();

                        const answer = await pc.createAnswer();
                        await pc.setLocalDescription(answer);
                        console.log(" Answer created and set as local description");

                        await new Promise(resolve => setTimeout(resolve, 2000));

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

                            signalingState.current = 'connected';
                            console.log(" Answer saved successfully");
                        }
                    } else {
                        console.warn(`Skipping offer processing, wrong signaling state: ${pc.signalingState}`);
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
                console.error(" Error handling RTC data:", error);
                setConnectionError("WebRTC接続データの処理に失敗しました");
                setConnectionState('failed');
                setTimeout(() => resetConnection(), 3000);
            }
        });

        return unsubscribeRTC;
    }, [roomId, otherPlayerId, isHost, addIceCandidateToQueue, processQueuedIceCandidates, userId, resetConnection]);

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
            signalingState.current = 'idle';
            remoteDescriptionSet.current = false;
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
