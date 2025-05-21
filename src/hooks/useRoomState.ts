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

    // ピアからのメッセージを処理
    const handlePeerMessage = useCallback((message: string) => {
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

                    // ローカルのroomステートを更新
                    setRoom(prev => {
                        if (!prev) return null;
                        return {
                            ...prev,
                            gameState: updatedGameState
                        };
                    });

                    console.log("Updated game state with peer progress:", updatedGameState);
                }
            } else if (data.type === 'connected') {
                console.log("Received connection confirmation from peer:", data.userId);
            }
        } catch (error) {
            console.error('Error parsing peer message:', error);
        }
    }, [otherPlayerId, room]);

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

                // ゲームの状態を更新 - 自分の状態のみ
                if (roomData.gameState) {
                    console.log("Game state:", roomData.gameState);

                    // 自分のプレイヤーデータのみを参照
                    const playerData = roomData.gameState.players?.[userId];
                    if (playerData) {
                        setIsReady(playerData.ready || false);
                    }
                }
            } else {
                console.log("No room data received");
                setRoom(null);
            }
        });

        return () => {
            console.log("Unsubscribing from room");
            unsubscribe();
        };
    }, [roomId, userId]);

    return {
        room,
        isHost,
        otherPlayerId,
        isReady,
        handlePeerMessage
    };
};
