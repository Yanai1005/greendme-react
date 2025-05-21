import { useState, useEffect, useRef, useCallback } from 'react';
import { saveRTCData, subscribeToRTCData } from '../services/room';
import type { RTCConnectionData } from '../services/room/types';

interface UseWebRTCProps {
    roomId: string;
    userId: string;
    otherPlayerId: string | null;
    isHost: boolean;
}

interface UseWebRTCReturn {
    isConnected: boolean;
    connectionError: string | null;
    dataChannel: React.RefObject<RTCDataChannel | null>; // MutableRefObject から RefObject に変更
    sendMessage: (message: object) => boolean;
    resetConnection: () => void;
}

export const useWebRTC = ({
    roomId,
    userId,
    otherPlayerId,
    isHost
}: UseWebRTCProps): UseWebRTCReturn => {
    const [isConnected, setIsConnected] = useState(false);
    const [connectionError, setConnectionError] = useState<string | null>(null);
    const peerConnection = useRef<RTCPeerConnection | null>(null);
    const dataChannel = useRef<RTCDataChannel | null>(null);
    const rtcInitialized = useRef<boolean>(false);

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

    // WebRTC接続のリセット
    const resetConnection = useCallback(() => {
        console.log("Resetting WebRTC connection");

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
        rtcInitialized.current = false;

        // 少し待ってから再接続を試みる
        setTimeout(() => {
            console.log("Attempting to reconnect WebRTC");
            rtcInitialized.current = false;
        }, 2000);
    }, []);

    // WebRTC接続の初期化
    useEffect(() => {
        // 部屋情報と他のプレイヤーが存在する場合のみ初期化
        if (!roomId || !otherPlayerId || rtcInitialized.current) {
            console.log("Skipping WebRTC initialization:",
                !roomId ? "no roomId" :
                    !otherPlayerId ? "no other player" :
                        "already initialized");
            return;
        }

        console.log("Initializing WebRTC connection with player:", otherPlayerId);

        // 既存の接続をクリーンアップ
        if (peerConnection.current) {
            console.log("Cleaning up existing connection");
            peerConnection.current.close();
            peerConnection.current = null;
        }

        if (dataChannel.current) {
            dataChannel.current.close();
            dataChannel.current = null;
        }

        setConnectionError(null);
        rtcInitialized.current = true;

        // 接続タイムアウトの参照を保持
        let connectionTimeoutId: NodeJS.Timeout | null = null;

        const initWebRTC = async () => {
            try {
                // WebRTC接続の設定
                const pc = new RTCPeerConnection({
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' },
                        { urls: 'stun:stun2.l.google.com:19302' }
                    ],
                    iceCandidatePoolSize: 10
                });
                peerConnection.current = pc;

                console.log("RTCPeerConnection created, signaling state:", pc.signalingState);

                // 接続状態の監視
                pc.oniceconnectionstatechange = () => {
                    console.log("ICE connection state:", pc.iceConnectionState);
                    if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
                        setIsConnected(true);
                        setConnectionError(null);
                        if (connectionTimeoutId) {
                            clearTimeout(connectionTimeoutId);
                            connectionTimeoutId = null;
                        }
                    } else if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'closed') {
                        setIsConnected(false);
                        setConnectionError(`WebRTC接続エラー: ${pc.iceConnectionState}`);
                    }
                };

                pc.onconnectionstatechange = () => {
                    console.log("Connection state:", pc.connectionState);
                    if (pc.connectionState === 'connected') {
                        setIsConnected(true);
                        setConnectionError(null);
                        if (connectionTimeoutId) {
                            clearTimeout(connectionTimeoutId);
                            connectionTimeoutId = null;
                        }
                    } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected' || pc.connectionState === 'closed') {
                        setIsConnected(false);
                        setConnectionError(`WebRTC接続エラー: ${pc.connectionState}`);
                    }
                };

                // ICE candidateの処理
                pc.onicecandidate = async (event) => {
                    if (event.candidate) {
                        console.log("ICE candidate generated:", event.candidate);
                        // ICE candidateを保存
                        try {
                            // 現在の接続情報を取得
                            let currentData: RTCConnectionData = {
                                candidates: []
                            };

                            // 現在のローカル記述を取得
                            const localDesc = pc.localDescription;
                            if (localDesc) {
                                // シリアライズ可能な形式に変換
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

                            // ICE候補をシリアライズ可能な形式に変換
                            const serializedCandidate = {
                                candidate: event.candidate.candidate,
                                sdpMid: event.candidate.sdpMid,
                                sdpMLineIndex: event.candidate.sdpMLineIndex,
                                usernameFragment: event.candidate.usernameFragment
                            };

                            // 候補を追加
                            currentData.candidates = [serializedCandidate];

                            await saveRTCData(roomId, userId, currentData);
                            console.log("RTC data saved");
                        } catch (error) {
                            console.error("Error saving RTC data:", error);
                            setConnectionError("ICE candidateの保存に失敗しました");
                        }
                    }
                };

                // タイムアウト処理
                connectionTimeoutId = setTimeout(() => {
                    if (!isConnected && peerConnection.current) {
                        console.log("Connection timeout, current state:", peerConnection.current.connectionState);
                        setConnectionError("WebRTC接続がタイムアウトしました。再接続してください。");
                    }
                }, 30000); // 30秒タイムアウト

                const handleChannelOpen = () => {
                    console.log('Data channel opened');
                    setIsConnected(true);
                    setConnectionError(null);
                    if (connectionTimeoutId) {
                        clearTimeout(connectionTimeoutId);
                        connectionTimeoutId = null;
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
                };

                const handleChannelError = (error: Event) => {
                    console.error('Data channel error:', error);
                    setConnectionError("データチャネルでエラーが発生しました");
                };

                if (isHost) {
                    // ホスト側はデータチャネルを作成
                    try {
                        const channel = pc.createDataChannel('game', {
                            ordered: true,
                            maxRetransmits: 3 // 再送回数を制限
                        });
                        dataChannel.current = channel;

                        console.log("Data channel created by host");

                        channel.onopen = handleChannelOpen;
                        channel.onclose = handleChannelClose;
                        channel.onerror = handleChannelError;

                        // オファーを作成して保存
                        const offer = await pc.createOffer({
                            offerToReceiveAudio: false,
                            offerToReceiveVideo: false
                        });
                        await pc.setLocalDescription(offer);
                        console.log("Offer created:", offer);

                        // オファーをシリアライズ可能な形式に変換
                        const serializedOffer = {
                            type: offer.type,
                            sdp: offer.sdp || ''
                        };

                        await saveRTCData(roomId, userId, {
                            offer: serializedOffer,
                            candidates: []
                        });
                        console.log("Offer saved");
                    } catch (error) {
                        console.error("Error in host setup:", error);
                        setConnectionError("ホスト側の接続設定に失敗しました");
                    }
                } else {
                    // ゲスト側はデータチャネルを受信
                    try {
                        pc.ondatachannel = (event) => {
                            const channel = event.channel;
                            dataChannel.current = channel;

                            console.log("Data channel received by guest");

                            channel.onopen = handleChannelOpen;
                            channel.onclose = handleChannelClose;
                            channel.onerror = handleChannelError;
                        };
                    } catch (error) {
                        console.error("Error in guest setup:", error);
                        setConnectionError("ゲスト側の接続設定に失敗しました");
                    }
                }
            } catch (error) {
                console.error("Error initializing WebRTC:", error);
                setConnectionError("WebRTC接続の初期化に失敗しました");
            }
        };

        // 少し待ってから接続を初期化
        const initTimeoutId = setTimeout(() => {
            initWebRTC();
        }, 1000);

        // 相手のWebRTC接続情報を監視
        console.log("Subscribing to RTC data for:", otherPlayerId);

        const unsubscribeRTC = subscribeToRTCData(roomId, otherPlayerId, async (data) => {
            if (!data || !peerConnection.current) {
                console.log("No RTC data or peer connection");
                return;
            }

            console.log("RTC data received:", data);

            try {
                if (isHost && data.answer) {
                    // ホスト側はアンサーを受信
                    console.log("Host received answer, connection state:", peerConnection.current.signalingState);

                    // 接続状態が適切な場合のみ処理
                    if (peerConnection.current.signalingState === 'have-local-offer') {
                        await peerConnection.current.setRemoteDescription({
                            type: data.answer.type as RTCSdpType,
                            sdp: data.answer.sdp
                        });
                        console.log("Remote description set (host)");
                    } else {
                        console.warn("Skipping answer processing, connection in wrong state:", peerConnection.current.signalingState);
                    }
                } else if (!isHost && data.offer) {
                    // ゲスト側はオファーを受信してアンサーを作成
                    console.log("Guest received offer, connection state:", peerConnection.current.signalingState);

                    // 接続状態が適切な場合のみ処理
                    if (peerConnection.current.signalingState === 'stable') {
                        await peerConnection.current.setRemoteDescription({
                            type: data.offer.type as RTCSdpType,
                            sdp: data.offer.sdp
                        });
                        console.log("Remote description set (guest)");

                        const answer = await peerConnection.current.createAnswer();
                        await peerConnection.current.setLocalDescription(answer);
                        console.log("Answer created:", answer);

                        // アンサーをシリアライズ可能な形式に変換
                        const serializedAnswer = {
                            type: answer.type,
                            sdp: answer.sdp || ''
                        };

                        await saveRTCData(roomId, userId, {
                            answer: serializedAnswer,
                            candidates: []
                        });
                        console.log("Answer saved");
                    } else {
                        console.warn("Skipping offer processing, connection in wrong state:", peerConnection.current.signalingState);
                    }
                }

                // ICE candidateを追加
                if (data.candidates && data.candidates.length > 0) {
                    for (const candidate of data.candidates) {
                        if (!candidate) continue;

                        if (!peerConnection.current.remoteDescription) {
                            console.log("Skipping ICE candidate, remote description not set");
                            continue;
                        }

                        try {
                            console.log("Adding ICE candidate");
                            await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
                        } catch (icErr) {
                            console.warn("Error adding ICE candidate:", icErr);
                            // 個別のICE候補の追加エラーは無視して続行
                        }
                    }
                }
            } catch (error) {
                console.error("Error handling RTC data:", error);
                setConnectionError("WebRTC接続データの処理に失敗しました");
            }
        });

        return () => {
            console.log("Cleaning up WebRTC connection");
            unsubscribeRTC();

            if (connectionTimeoutId) {
                clearTimeout(connectionTimeoutId);
            }

            if (initTimeoutId) {
                clearTimeout(initTimeoutId);
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
        };
    }, [roomId, userId, otherPlayerId, isHost, sendMessage]);

    return {
        isConnected,
        connectionError,
        dataChannel,
        sendMessage,
        resetConnection
    };
};
