import React, { useState, useEffect, useRef } from 'react';
import { subscribeToRoom, saveRTCData, subscribeToRTCData } from '../services/roomService';
import type { RTCConnectionData, Room } from '../services/roomService';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase/config';

const QUESTION_SETS = [
    // セット1: 基本的な操作
    [
        'git init',
        'git add .',
        'git commit -m "first commit"',
        'git status',
        'git branch',
        'git push origin main',
        'git push -f origin main'
    ]
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
    totalProgress?: number;
    currentSetIndex?: number;
    currentQuestionIndex?: number;
}

const TypingGame: React.FC<TypingGameProps> = ({ roomId, userId, userName }) => {
    const [room, setRoom] = useState<Room | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [typingText, setTypingText] = useState('');
    const [inputText, setInputText] = useState('');
    const [progress, setProgress] = useState(0);
    const [totalProgress, setTotalProgress] = useState(0);
    const [score, setScore] = useState(0);
    const [startTime, setStartTime] = useState<number | null>(null);
    const [gameStatus, setGameStatus] = useState<'waiting' | 'ready' | 'playing' | 'finished'>('waiting');
    const [otherPlayerId, setOtherPlayerId] = useState<string | null>(null);
    const [connectionError, setConnectionError] = useState<string | null>(null);
    const [isNotFoundEnding, setIsNotFoundEnding] = useState(false);
    const [endReason, setEndReason] = useState<string | null>(null);

    // WebRTC関連の状態
    const peerConnection = useRef<RTCPeerConnection | null>(null);
    const dataChannel = useRef<RTCDataChannel | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isHost, setIsHost] = useState(false);
    const rtcInitialized = useRef<boolean>(false);

    // 現在の問題セットと問題インデックスを管理する状態を追加
    const [currentSetIndex, setCurrentSetIndex] = useState(0);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

    // 問題の総数を計算する関数
    const getTotalQuestionCount = () => {
        return QUESTION_SETS.reduce((total, set) => total + set.length, 0);
    };

    // 現在の問題が全体の何番目かを計算する関数
    const getCurrentQuestionNumber = () => {
        let questionNumber = 0;
        for (let i = 0; i < currentSetIndex; i++) {
            questionNumber += QUESTION_SETS[i].length;
        }
        return questionNumber + currentQuestionIndex + 1; // +1 は0始まりの配列インデックスを1始まりに変換
    };

    // 全体の進捗率を計算する関数
    const calculateTotalProgress = () => {
        const currentNumber = getCurrentQuestionNumber();
        const totalNumber = getTotalQuestionCount();
        return Math.floor((currentNumber / totalNumber) * 100);
    };

    // 部屋の情報を監視
    useEffect(() => {
        console.log("Subscribing to room:", roomId);

        // 初期状態を設定（最初のロード時のみ）
        if (!typingText && QUESTION_SETS[0][0]) {
            console.log("Setting initial empty question for display");
            setTypingText(QUESTION_SETS[0][0]);
            setCurrentSetIndex(0);
            setCurrentQuestionIndex(0);
        }

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

                // ゲームの状態を更新 - 自分の状態とルーム内の参加者の準備状態のみ
                if (roomData.gameState) {
                    console.log("Game state:", roomData.gameState);

                    // 自分のプレイヤーデータのみを参照
                    const playerData = roomData.gameState.players?.[userId];
                    if (playerData) {
                        setIsReady(playerData.ready || false);
                    }

                    // 全員が準備完了したかチェック
                    let allReady = true;
                    let playerCount = 0;

                    // 参加者全員が準備OKか確認
                    if (roomData.participants && roomData.gameState.players) {
                        roomData.participants.forEach(participantId => {
                            const participant = roomData.gameState.players[participantId];
                            if (participant) {
                                playerCount++;
                                if (!participant.ready) {
                                    allReady = false;
                                }
                            }
                        });
                    }

                    // 2人以上のプレイヤーがいて全員が準備完了したらゲーム開始
                    if (allReady && playerCount >= 2 && gameStatus === 'waiting') {
                        console.log("All players ready, starting game");
                        // ゲーム開始（問題テキストはローカルに既に設定済み）
                        setGameStatus('playing');
                        if (!startTime) {
                            setStartTime(Date.now());
                        }
                    }

                    // 注意：問題テキストの更新は行わない
                    // - プレイヤーの状態のみを更新（問題テキストはローカルで管理）
                }
            } else {
                console.log("No room data received");
            }
        });

        return () => {
            console.log("Unsubscribing from room");
            unsubscribe();
        };
    }, [roomId, userId, gameStatus, startTime, typingText]);

    // プレイヤーの進捗状態を更新
    const updatePlayerState = async (progress: number, score: number, setIndex: number, questionIndex: number) => {
        try {
            const currentTotalProgress = calculateTotalProgress();
            setTotalProgress(currentTotalProgress);

            // Firestoreに進捗を保存
            const roomRef = doc(db, 'rooms', roomId);
            await updateDoc(roomRef, {
                [`gameState.players.${userId}.progress`]: progress,
                [`gameState.players.${userId}.score`]: score,
                [`gameState.players.${userId}.totalProgress`]: currentTotalProgress,
                [`gameState.players.${userId}.currentSetIndex`]: setIndex,
                [`gameState.players.${userId}.currentQuestionIndex`]: questionIndex
            });

            console.log("Player state updated in Firestore:", {
                progress, score, totalProgress: currentTotalProgress,
                setIndex, questionIndex
            });

            return true;
        } catch (error) {
            console.error("Error updating player state:", error);
            throw error;
        }
    };

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
                        updatedGameState.players[otherPlayerId] = {
                            ready: true,
                            progress: 0,
                            score: 0,
                            totalProgress: 0
                        };
                    }
                    updatedGameState.players[otherPlayerId].progress = data.progress;
                    updatedGameState.players[otherPlayerId].score = data.score || 0;
                    updatedGameState.players[otherPlayerId].totalProgress = data.totalProgress || 0;

                    console.log("Updated game state with peer progress:", updatedGameState);
                }
            } else if (data.type === 'connected') {
                console.log("Received connection confirmation from peer:", data.userId);
                setIsConnected(true);
                setConnectionError(null);
            } else if (data.type === 'notFound') {
                // 相手が「git push -f origin main」を完了した場合
                console.log("Peer encountered Not Found");
                // 修正: 相手がNot Foundを送信した場合も終了する
                setIsNotFoundEnding(true);
                setGameStatus('finished');
            }
            // nextQuestionタイプは処理しない（問題同期をしない）
        } catch (error) {
            console.error('Error parsing peer message:', error);
        }
    };

    // 入力テキストが変更されたとき
    const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (gameStatus !== 'playing') return;

        const inputValue = e.target.value;
        setInputText(inputValue);

        // 進捗を計算（文字ごとの一致率）
        let matchCount = 0;
        const minLength = Math.min(inputValue.length, typingText.length);

        for (let i = 0; i < minLength; i++) {
            if (inputValue[i] === typingText[i]) {
                matchCount++;
            }
        }

        // 長さの違いによるペナルティを計算
        const lengthPenalty = Math.abs(inputValue.length - typingText.length) * 5;

        // 達成度を計算（最大100%）
        const newProgress = Math.max(0, Math.min(100, Math.round((matchCount / typingText.length) * 100 - lengthPenalty)));
        setProgress(newProgress);

        // 経過時間からスコアを計算
        if (startTime) {
            const elapsedTime = (Date.now() - startTime) / 1000; // 秒単位
            const newScore = Math.floor((matchCount / elapsedTime) * 60); // 1分あたりの文字数
            setScore(newScore);
        }

        // 全体の進捗率を更新
        const currentTotalProgress = calculateTotalProgress();
        setTotalProgress(currentTotalProgress);

        // Firestoreに進捗を保存（リアルタイム更新）
        try {
            await updatePlayerState(newProgress, score, currentSetIndex, currentQuestionIndex);
        } catch (err) {
            console.error("Error updating progress in Firebase:", err);
        }

        // WebRTC通信はタイピング中には行わない（問題完了時のみ通知）

        // タイピングが完了したかチェック
        if (inputValue === typingText) {
            console.log("Question completed:", typingText);

            // git push -f origin mainの場合はNot Found
            if (typingText === 'git push -f origin main') {
                console.log("Showing Not Found for force push");
                setIsNotFoundEnding(true);
                setGameStatus('finished');
                try {
                    await updatePlayerState(100, score, currentSetIndex, currentQuestionIndex);
                } catch (err) {
                    console.error("Error updating final progress:", err);
                }

                // ゲーム終了を相手に通知
                if (dataChannel.current?.readyState === 'open') {
                    dataChannel.current.send(JSON.stringify({
                        type: 'notFound',
                        timestamp: Date.now()
                    }));
                }
            } else {
                // 通常の完了処理 - 強制的に次の問題を設定
                console.log("Question completed, moving to next question");

                // 次の問題のインデックスを計算
                let nextSetIndex = currentSetIndex;
                let nextQuestionIndex = currentQuestionIndex + 1;
                let nextQuestion = '';

                // セット内に次の問題がある場合
                if (nextQuestionIndex < QUESTION_SETS[currentSetIndex].length) {
                    nextQuestion = QUESTION_SETS[currentSetIndex][nextQuestionIndex];
                } else {
                    // 次のセットに移動
                    nextSetIndex = (currentSetIndex + 1) % QUESTION_SETS.length;
                    nextQuestionIndex = 0;
                    nextQuestion = QUESTION_SETS[nextSetIndex][0];
                }

                console.log("Next question will be:", nextQuestion);

                // Firestore更新
                try {
                    // ゲーム状態をすべて一度に更新
                    const roomRef = doc(db, 'rooms', roomId);
                    await updateDoc(roomRef, {
                        'gameState.typingText': nextQuestion,
                        'gameState.status': 'playing',
                        [`gameState.players.${userId}.progress`]: 0,
                        [`gameState.players.${userId}.currentSetIndex`]: nextSetIndex,
                        [`gameState.players.${userId}.currentQuestionIndex`]: nextQuestionIndex
                    });

                    // ローカル状態の更新
                    setCurrentSetIndex(nextSetIndex);
                    setCurrentQuestionIndex(nextQuestionIndex);
                    setTypingText(nextQuestion);
                    setInputText('');
                    setProgress(0);

                    // 全体の進捗率を更新
                    const newTotalProgress = calculateTotalProgress();
                    setTotalProgress(newTotalProgress);

                    console.log("Successfully moved to next question");

                    // 問題完了時に進捗情報をWebRTC経由で相手に送信
                    if (dataChannel.current?.readyState === 'open') {
                        dataChannel.current.send(JSON.stringify({
                            type: 'progress',
                            progress: 0, // 新しい問題の進捗
                            score: score,
                            totalProgress: newTotalProgress,
                            completed: true, // 問題が完了したフラグ
                            timestamp: Date.now()
                        }));
                        console.log("Progress update sent on question completion");
                    }
                } catch (err) {
                    console.error("Failed to update to next question:", err);
                }
            }
        }
    };

    // 準備状態を切り替える
    const toggleReady = async () => {
        const newReadyState = !isReady;
        setIsReady(newReadyState);

        try {
            // 準備状態をFirestoreで更新
            const roomRef = doc(db, 'rooms', roomId);
            await updateDoc(roomRef, {
                [`gameState.players.${userId}.ready`]: newReadyState,
                [`gameState.players.${userId}.progress`]: 0
            });

            console.log("Player ready state updated in Firestore:", newReadyState);
            setIsNotFoundEnding(false);
            setEndReason(null);
            if (newReadyState) {
                const initialSet = 0;
                const initialQuestion = 0;
                const initialText = QUESTION_SETS[initialSet][initialQuestion];

                console.log("Setting up initial question in local state:", initialText);

                setCurrentSetIndex(initialSet);
                setCurrentQuestionIndex(initialQuestion);
                setInputText('');
                setProgress(0);
                setScore(0);
                setTotalProgress(0);
                setTypingText(initialText);
            }
        } catch (error) {
            console.error("Error updating ready state:", error);

            setIsReady(!newReadyState);
        }
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
                <div className="progress-bar" style={{ marginTop: '5px' }}>
                    <div
                        className="progress-fill bg-red-500"
                        style={{ width: `${player.totalProgress || 0}%` }}
                    ></div>
                </div>
                <div className="progress-text">{player.totalProgress || 0}% (全体)</div>
            </div>
        );
    };

    // ゲーム結果の表示
    const renderGameResult = () => {
        if (gameStatus !== 'finished') return null;

        // Not Found エンディングの場合（typingTextでの判断を修正）
        if (isNotFoundEnding || typingText === 'git push -f origin main') {
            return (
                <div className="game-result">
                    <h3>Not Found</h3>
                    <p>このコマンドは実行できません</p>
                    {endReason && <p className="text-sm text-gray-600 mt-2">{endReason}</p>}
                </div>
            );
        }
    };

    if (!room) {
        return <div>ルーム情報を読み込み中...</div>;
    }

    return (
        <div className="typing-game">
            <h2>Gitコマンドタイピングゲーム</h2>

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
                <div>問題セット: {currentSetIndex + 1}/{QUESTION_SETS.length} - 問題: {currentQuestionIndex + 1}/{QUESTION_SETS[currentSetIndex].length}</div>
                <div>全体進捗率: {totalProgress}%</div>
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
                        <div className="text-sm text-gray-500 mt-2">
                            問題 {currentQuestionIndex + 1}/{QUESTION_SETS[0].length}
                        </div>
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
                            <div className="progress-bar" style={{ marginTop: '5px' }}>
                                <div
                                    className="progress-fill bg-green-500"
                                    style={{ width: `${totalProgress}%` }}
                                ></div>
                            </div>
                        </div>

                        {renderOtherPlayerProgress()}
                    </div>
                </div>
            )}

            {renderGameResult()}
        </div>
    );
};

export default TypingGame;
