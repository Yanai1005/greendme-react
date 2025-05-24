import { useState, useEffect, useCallback } from 'react';
import { subscribeToRoom } from '../services/room';
import type { Room } from '../services/room/types';

interface UseRoomStateProps {
    roomId: string;
    userId: string;
}

interface UseRoomStateReturn {
    room: Room | null;
    isHost: boolean;
    otherPlayerId: string | null;
    isReady: boolean;
    bothPlayersReady: boolean;
    shouldStartWebRTC: boolean;
    handlePeerMessage: (message: string) => void;
}

export const useRoomState = ({
    roomId,
    userId
}: UseRoomStateProps): UseRoomStateReturn => {
    const [room, setRoom] = useState<Room | null>(null);
    const [isHost, setIsHost] = useState(false);
    const [otherPlayerId, setOtherPlayerId] = useState<string | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [bothPlayersReady, setBothPlayersReady] = useState(false);
    const [shouldStartWebRTC, setShouldStartWebRTC] = useState(false);

    // ピアからのメッセージを処理
    const handlePeerMessage = useCallback((message: string) => {
        try {
            const data = JSON.parse(message);
            console.log("Parsed peer message:", data.type);

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

                    setRoom(prev => {
                        if (!prev) return null;
                        return {
                            ...prev,
                            gameState: updatedGameState
                        };
                    });

                    console.log("Updated game state with peer progress");
                }
            } else if (data.type === 'connected') {
                console.log(" Received connection confirmation from peer:", data.userId);
            }
        } catch (error) {
            console.error('Error parsing peer message:', error);
        }
    }, [otherPlayerId, room]);

    // 両プレイヤーの準備状態をチェック
    const checkBothPlayersReady = useCallback((roomData: Room, currentOtherPlayerId: string | null) => {
        if (!roomData.gameState?.players || !currentOtherPlayerId) {
            console.log("Cannot check ready state: missing game state or other player");
            return false;
        }

        const myPlayerData = roomData.gameState.players[userId];
        const otherPlayerData = roomData.gameState.players[currentOtherPlayerId];

        const myReady = myPlayerData?.ready || false;
        const otherReady = otherPlayerData?.ready || false;

        console.log(`Player ready states: me(${userId.substring(0, 8)}): ${myReady}, other(${currentOtherPlayerId.substring(0, 8)}): ${otherReady}`);

        return myReady && otherReady;
    }, [userId]);

    // WebRTC接続開始の条件
    const shouldInitiateWebRTC = useCallback((
        roomData: Room,
        currentOtherPlayerId: string | null,
        currentBothReady: boolean
    ): boolean => {
        if (!currentOtherPlayerId || !currentBothReady) {
            return false;
        }

        // 部屋に2人いることを確認
        if (roomData.participants.length !== 2) {
            console.log(" Room does not have exactly 2 participants");
            return false;
        }

        // ゲーム状態が終了状態でないことを確認（playing状態でもWebRTC接続は必要）
        const gameStatus = roomData.gameState?.status;
        if (gameStatus === 'finished') {
            console.log(` Game status not suitable for WebRTC: ${gameStatus}`);
            return false;
        }

        console.log(" All conditions met for WebRTC initialization");
        return true;
    }, []);

    // 部屋の情報を監視
    useEffect(() => {
        console.log("👂 Subscribing to room:", roomId);

        const unsubscribe = subscribeToRoom(roomId, (roomData) => {
            if (!roomData) {
                console.log(" No room data received");
                setRoom(null);
                setOtherPlayerId(null);
                setBothPlayersReady(false);
                setShouldStartWebRTC(false);
                return;
            }

            console.log(" Room data updated - participants:", roomData.participants.length);
            setRoom(roomData);

            // 自分がホストかどうか判定（部屋の作成者）
            const isCurrentHost = roomData.participants.length > 0 && roomData.participants[0] === userId;
            setIsHost(isCurrentHost);
            console.log(` Host status: ${isCurrentHost ? 'HOST' : 'GUEST'}`);

            // 他のプレイヤーを検出
            const currentOtherPlayer = roomData.participants.find(id => id !== userId) || null;

            if (currentOtherPlayer) {
                console.log("👥 Other player found:", currentOtherPlayer.substring(0, 8));
                setOtherPlayerId(currentOtherPlayer);
            } else {
                console.log("👤 No other player in the room yet");
                setOtherPlayerId(null);
                setBothPlayersReady(false);
                setShouldStartWebRTC(false);
            }

            // ゲームの状態を更新
            if (roomData.gameState) {
                console.log(" Game state status:", roomData.gameState.status);

                // 自分のプレイヤーデータを参照
                const playerData = roomData.gameState.players?.[userId];
                if (playerData) {
                    const currentIsReady = playerData.ready || false;
                    setIsReady(currentIsReady);
                    console.log(`🎯 My ready status: ${currentIsReady}`);
                }

                // 両プレイヤーの準備状態をチェック
                const currentBothReady = checkBothPlayersReady(roomData, currentOtherPlayer);
                setBothPlayersReady(currentBothReady);

                // WebRTC接続開始の判定
                const shouldStart = shouldInitiateWebRTC(roomData, currentOtherPlayer, currentBothReady);

                setShouldStartWebRTC(prev => {
                    if (prev !== shouldStart) {
                        console.log(`WebRTC start condition changed: ${prev} -> ${shouldStart}`);
                        return shouldStart;
                    }
                    return prev;
                });
            } else {
                console.log(" No game state found");
                setIsReady(false);
                setBothPlayersReady(false);
                setShouldStartWebRTC(false);
            }
        });

        return () => {
            console.log("🧹 Unsubscribing from room");
            unsubscribe();
        };
    }, [roomId, userId, checkBothPlayersReady, shouldInitiateWebRTC]);

    // デバッグ
    useEffect(() => {
        console.log(`Room State Summary:
  - Room: ${room ? 'loaded' : 'loading'}
  - Participants: ${room?.participants.length || 0}/2
  - Other Player: ${otherPlayerId ? otherPlayerId.substring(0, 8) : 'none'}
  - My Ready: ${isReady}
  - Both Ready: ${bothPlayersReady}
  - Should Start WebRTC: ${shouldStartWebRTC}
  - Is Host: ${isHost}`);
    }, [room, otherPlayerId, isReady, bothPlayersReady, shouldStartWebRTC, isHost]);

    return {
        room,
        isHost,
        otherPlayerId,
        isReady,
        bothPlayersReady,
        shouldStartWebRTC,
        handlePeerMessage
    };
};
