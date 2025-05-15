import React, { useState, useEffect, useRef } from 'react';
import {
    updatePlayerReady,
    updatePlayerProgress,
    subscribeToRoom,
    saveRTCData,
    subscribeToRTCData
} from '../services/roomService';
import type { RTCConnectionData, Room } from '../services/roomService';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase/config';

const TYPING_TEXTS = [
    "こんにちは、タイピングゲームへようこそ。早く正確に入力して勝利しましょう。",
    "プログラミングは論理的思考を鍛えるのに最適な方法です。",
    "WebRTCを使うと、ブラウザ間で直接通信ができます。",
    "Firebaseは、モバイルアプリやウェブアプリの開発を支援するプラットフォームです。",
    "TypeScriptは、JavaScriptに型システムを追加したプログラミング言語です。"
];

interface TypingGameProps {
    roomId: string;
    userId: string;
    userName: string;
}

interface Player {
    ready: boolean;
    score: number;
    progress: number;
}

const TypingGame: React.FC<TypingGameProps> = ({ roomId, userId, userName }) => {
    const [room, setRoom] = useState<Room | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [typingText, setTypingText] = useState('');
    const [inputText, setInputText] = useState('');
    const [progress, setProgress] = useState(0);
    const [score, setScore] = useState(0);
    const [startTime, setStartTime] = useState<number | null>(null);
    const [gameStatus, setGameStatus] = useState<'waiting' | 'ready' | 'playing' | 'finished'>('waiting');
    const [otherPlayerId, setOtherPlayerId] = useState<string | null>(null);
    const [connectionError, setConnectionError] = useState<string | null>(null);

    // WebRTC関連の状態
    const peerConnection = useRef<RTCPeerConnection | null>(null);
    const dataChannel = useRef<RTCDataChannel | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isHost, setIsHost] = useState(false);
    const rtcInitialized = useRef<boolean>(false);

    // デバッグ用ログ
    useEffect(() => {
        console.log("Room ID:", roomId);
        console.log("User ID:", userId);
    }, [roomId, userId]);

    // 部屋の情報を監視
    useEffect(() => {
        console.log("Subscribing to room:", roomId);

        const unsubscribe = subscribeToRoom(roomId, (roomData) => {
            if (roomData) {
                console.log("Room data updated:", roomData);
                setRoom(roomData);

                // 自分がホストかどうか判定（部屋の作成者）
                if (roomData.participants.length > 0 && roomData.participants[0] === userId) {
                    setIsHost(true);
                }

                // 他のプレイヤーを検出
                const otherPlayer = roomData.participants.find(id => id !== userId);
                if (otherPlayer) {
                    console.log("Other player found:", otherPlayer);
                    setOtherPlayerId(otherPlayer);
                } else {
                    console.log("No other player in the room");
                    setOtherPlayerId(null);
                }

                // ゲームの状態を更新
                if (roomData.gameState) {
                    console.log("Game state:", roomData.gameState);
                    setGameStatus(roomData.gameState.status || 'waiting');

                    // 自分の準備状態を更新
                    if (roomData.gameState.players && roomData.gameState.players[userId]) {
                        setIsReady(roomData.gameState.players[userId].ready || false);
                    }

                    // タイピングテキストを設定
                    if (roomData.gameState.typingText) {
                        setTypingText(roomData.gameState.typingText);
                    }

                    // ゲーム開始時の処理
                    if (roomData.gameState.status === 'playing') {
                        if (!startTime) {
                            setStartTime(Date.now());
                        }
                    }
                }
            } else {
                console.log("No room data received");
            }
        });

        return () => {
            console.log("Unsubscribing from room");
            unsubscribe();
        };
    }, [roomId, userId]);

    // WebRTC接続の初期化
    useEffect(() => {
        // 部屋情報と他のプレイヤーが存在する場合のみ初期化
        if (!room || !otherPlayerId || rtcInitialized.current) {
            console.log("Skipping WebRTC initialization:",
                !room ? "no room" :
                    !otherPlayerId ? "no other player" :
                        "already initialized");
            return;
        }

        console.log("Initializing WebRTC connection with player:", otherPlayerId);
        console.log("Room participants:", room.participants);

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

                if (isHost) {
                    // ホスト側はデータチャネルを作成
                    try {
                        const channel = pc.createDataChannel('game', {
                            ordered: true,
                            maxRetransmits: 3 // 再送回数を制限
                        });
                        dataChannel.current = channel;

                        console.log("Data channel created by host");

                        channel.onopen = () => {
                            console.log('Data channel opened');
                            setIsConnected(true);
                            setConnectionError(null);
                            if (connectionTimeoutId) {
                                clearTimeout(connectionTimeoutId);
                                connectionTimeoutId = null;
                            }

                            // 接続成功を通知
                            try {
                                channel.send(JSON.stringify({
                                    type: 'connected',
                                    userId: userId,
                                    timestamp: Date.now()
                                }));
                            } catch (err) {
                                console.error("Error sending initial message:", err);
                            }
                        };

                        channel.onclose = () => {
                            console.log('Data channel closed');
                            setIsConnected(false);
                        };

                        channel.onerror = (error) => {
                            console.error('Data channel error:', error);
                            setConnectionError("データチャネルでエラーが発生しました");
                        };

                        channel.onmessage = (event) => {
                            console.log("Message received:", event.data);
                            handlePeerMessage(event.data);
                        };

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

                            channel.onopen = () => {
                                console.log('Data channel opened');
                                setIsConnected(true);
                                setConnectionError(null);
                                if (connectionTimeoutId) {
                                    clearTimeout(connectionTimeoutId);
                                    connectionTimeoutId = null;
                                }

                                // 接続成功を通知
                                try {
                                    channel.send(JSON.stringify({
                                        type: 'connected',
                                        userId: userId,
                                        timestamp: Date.now()
                                    }));
                                } catch (err) {
                                    console.error("Error sending initial message:", err);
                                }
                            };

                            channel.onclose = () => {
                                console.log('Data channel closed');
                                setIsConnected(false);
                            };

                            channel.onerror = (error) => {
                                console.error('Data channel error:', error);
                                setConnectionError("データチャネルでエラーが発生しました");
                            };

                            channel.onmessage = (event) => {
                                console.log("Message received:", event.data);
                                handlePeerMessage(event.data);
                            };
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
    }, [roomId, userId, otherPlayerId, isHost]);

    // ピアからのメッセージを処理
    const handlePeerMessage = (message: string) => {
        try {
            const data = JSON.parse(message);
            console.log("Parsed peer message:", data);

            if (data.type === 'progress') {
                // 相手の進捗を更新
                if (otherPlayerId && room?.gameState?.players) {
                    const updatedGameState = { ...room.gameState };
                    if (!updatedGameState.players[otherPlayerId]) {
                        updatedGameState.players[otherPlayerId] = { ready: true, progress: 0, score: 0 };
                    }
                    updatedGameState.players[otherPlayerId].progress = data.progress;
                    updatedGameState.players[otherPlayerId].score = data.score;

                    console.log("Updated game state with peer progress:", updatedGameState);
                }
            } else if (data.type === 'connected') {
                console.log("Received connection confirmation from peer:", data.userId);
                setIsConnected(true);
                setConnectionError(null);
            }
        } catch (error) {
            console.error('Error parsing peer message:', error);
        }
    };

    // 準備状態を切り替える
    const toggleReady = async () => {
        const newReadyState = !isReady;
        setIsReady(newReadyState);

        try {
            // ホストの場合、タイピングテキストを設定
            if (isHost && newReadyState) {
                const randomText = TYPING_TEXTS[Math.floor(Math.random() * TYPING_TEXTS.length)];
                console.log("Setting typing text:", randomText);

                // タイピングテキストを更新
                await updateTypingText(randomText);

                // ローカルの状態も更新
                setTypingText(randomText);
            }

            // 準備状態を更新
            await updatePlayerReady(roomId, userId, newReadyState);
            console.log("Ready state updated:", newReadyState);
        } catch (error) {
            console.error("Error updating ready state:", error);
            // エラーが発生した場合は状態を元に戻す
            setIsReady(!newReadyState);
        }
    };

    // タイピングテキストを更新
    const updateTypingText = async (text: string) => {
        if (!room) return;

        try {
            const roomRef = doc(db, 'rooms', roomId);
            await updateDoc(roomRef, {
                'gameState.typingText': text
            });
            console.log("Typing text updated in Firestore:", text);
        } catch (error) {
            console.error("Error updating typing text:", error);
            throw error;
        }
    };

    // 入力テキストが変更されたとき
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (gameStatus !== 'playing') return;

        const inputValue = e.target.value;
        setInputText(inputValue);

        // 進捗を計算
        const newProgress = Math.floor((inputValue.length / typingText.length) * 100);
        setProgress(newProgress);

        // 経過時間からスコアを計算
        if (startTime) {
            const elapsedTime = (Date.now() - startTime) / 1000; // 秒単位
            const newScore = Math.floor((inputValue.length / elapsedTime) * 60); // 1分あたりの文字数
            setScore(newScore);
        }

        // 進捗をFirebaseとピアに送信
        try {
            // Firebaseに進捗を保存
            updatePlayerProgress(roomId, userId, newProgress, score).catch(err => {
                console.error("Error updating progress in Firebase:", err);
            });

            // WebRTC経由で相手に進捗を送信
            if (dataChannel.current && dataChannel.current.readyState === 'open') {
                try {
                    dataChannel.current.send(JSON.stringify({
                        type: 'progress',
                        progress: newProgress,
                        score,
                        timestamp: Date.now()
                    }));
                    console.log("Progress sent via WebRTC:", newProgress);
                } catch (rtcErr) {
                    console.error("Error sending progress via WebRTC:", rtcErr);
                }
            } else {
                console.log("Data channel not ready, progress not sent. State:", dataChannel.current?.readyState || 'null');
            }

            // タイピングが完了したらゲーム終了
            if (inputValue === typingText) {
                updatePlayerProgress(roomId, userId, 100, score).catch(err => {
                    console.error("Error updating final progress:", err);
                });
                console.log("Typing completed, game finished");
            }
        } catch (error) {
            console.error("Error in handleInputChange:", error);
        }
    };

    // 他のプレイヤーの進捗を表示
    const renderOtherPlayerProgress = () => {
        if (!room || !room.gameState || !room.gameState.players || !otherPlayerId) {
            console.log("Cannot render other player progress, missing data");
            return null;
        }

        const player = room.gameState.players[otherPlayerId] as Player | undefined;
        if (!player) {
            console.log("Other player data not found");
            return null;
        }

        return (
            <div key={otherPlayerId} className="opponent-progress">
                <div className="player-name">対戦相手</div>
                <div className="progress-bar">
                    <div
                        className="progress-fill"
                        style={{ width: `${player.progress}%` }}
                    ></div>
                </div>
                <div className="progress-text">{player.progress}%</div>
                <div className="score">スコア: {player.score}</div>
            </div>
        );
    };

    // ゲーム結果の表示
    const renderGameResult = () => {
        if (gameStatus !== 'finished' || !room || !room.gameState) return null;

        const winner = room.gameState.winner;
        const isWinner = winner === userId;

        return (
            <div className="game-result">
                <h3>{isWinner ? '勝利！' : '敗北...'}</h3>
                <p>あなたのスコア: {score}</p>
                {room.gameState.players && otherPlayerId && room.gameState.players[otherPlayerId] && (
                    <p>相手のスコア: {(room.gameState.players[otherPlayerId] as Player).score}</p>
                )}
                <button onClick={toggleReady} className="ready-button">
                    もう一度プレイ
                </button>
            </div>
        );
    };

    // WebRTC接続をリセット
    const resetConnection = () => {
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
            // 再接続をトリガー
            if (room && otherPlayerId) {
                rtcInitialized.current = false;
            }
        }, 2000);
    };

    if (!room) {
        return <div>ルーム情報を読み込み中...</div>;
    }

    return (
        <div className="typing-game">
            <h2>タイピングゲーム</h2>

            <div className="game-status">
                ステータス: {
                    gameStatus === 'waiting' ? '待機中' :
                        gameStatus === 'ready' ? '準備完了' :
                            gameStatus === 'playing' ? 'ゲーム中' :
                                '終了'
                }
            </div>

            <div className="players-info">
                <div>プレイヤー: {userName} (あなた) [ID: {userId.substring(0, 8)}...]</div>
                <div>対戦相手: {
                    otherPlayerId
                        ? `接続中 [ID: ${otherPlayerId.substring(0, 8)}...]`
                        : '待機中...'
                }</div>
                <div>部屋ID: {roomId.substring(0, 8)}...</div>
                <div>参加者数: {room.participants.length}</div>
                <div>接続状態: {isConnected ? '接続済み' : '未接続'}</div>
                <div>準備状態: {isReady ? '準備完了' : '未準備'}</div>
                <div>タイピングテキスト: {typingText ? '設定済み' : '未設定'}</div>
            </div>

            {connectionError && (
                <div className="connection-error">
                    <p className="error-message">{connectionError}</p>
                    <button onClick={resetConnection} className="reset-button">
                        接続をリセット
                    </button>
                </div>
            )}

            {gameStatus === 'waiting' && (
                <div className="waiting-screen">
                    <p>{!otherPlayerId ? '対戦相手を待っています...' : '準備ができたらボタンを押してください'}</p>
                    {otherPlayerId && (
                        <div>
                            <button
                                onClick={toggleReady}
                                className={`ready-button ${isReady ? 'ready' : ''}`}
                            >
                                {isReady ? '準備完了！' : '準備する'}
                            </button>
                            {isReady && room?.gameState?.players && (
                                <p>
                                    対戦相手の準備状態: {
                                        otherPlayerId && room.gameState.players[otherPlayerId] && room.gameState.players[otherPlayerId].ready
                                            ? '準備完了'
                                            : '準備中...'
                                    }
                                </p>
                            )}
                        </div>
                    )}
                </div>
            )}

            {gameStatus === 'playing' && (
                <div className="game-screen">
                    <div className="typing-area">
                        <div className="typing-text">{typingText || 'タイピングテキストが設定されていません'}</div>
                        <input
                            type="text"
                            value={inputText}
                            onChange={handleInputChange}
                            className="typing-input"
                            autoFocus
                            disabled={!typingText}
                            placeholder={typingText ? "ここに入力してください" : "ゲームの準備中です..."}
                        />
                    </div>

                    <div className="progress-area">
                        <div className="your-progress">
                            <div className="player-name">あなた</div>
                            <div className="progress-bar">
                                <div
                                    className="progress-fill"
                                    style={{ width: `${progress}%` }}
                                ></div>
                            </div>
                            <div className="progress-text">{progress}%</div>
                            <div className="score">スコア: {score}</div>
                        </div>

                        {renderOtherPlayerProgress()}
                    </div>
                </div>
            )}

            {renderGameResult()}

            {/* デバッグ情報 */}
            <div className="debug-info" style={{ marginTop: '20px', fontSize: '12px', color: '#666' }}>
                <details>
                    <summary>デバッグ情報</summary>
                    <pre>
                        {JSON.stringify({
                            roomId,
                            userId,
                            isHost,
                            isReady,
                            gameStatus,
                            typingText: typingText ? `${typingText.substring(0, 20)}...` : 'なし',
                            participants: room?.participants,
                            gameState: room?.gameState,
                            rtcInitialized: rtcInitialized.current,
                            dataChannelState: dataChannel.current?.readyState || 'なし'
                        }, null, 2)}
                    </pre>
                </details>
            </div>
        </div>
    );
};

export default TypingGame; 
