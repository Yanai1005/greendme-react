import { useState, useEffect, useCallback } from 'react';
import { useTypingGame } from './useTypingGame';
import { PeerConnection } from '../services/webrtc/PeerConnection';
import { getRoom, updateRoomStatus } from '../services/firebase/rooms';
import { updatePlayerStatus } from '../services/firebase/players';
import type { Room, Player } from '../types/firebase';

interface UseMultiplayerGameProps {
    roomId: string;
    playerId: string;
    userId: string;
    isHost: boolean;
}

interface PlayerProgress {
    userId: string;
    userName: string;
    progress: number;
    wpm: number;
    isCompleted: boolean;
}

export const useMultiplayerGame = ({ roomId, playerId, userId, isHost }: UseMultiplayerGameProps) => {
    const [room, setRoom] = useState<Room | null>(null);
    const [roomPlayers, setRoomPlayers] = useState<Player[]>([]);
    const [peerConnection, setPeerConnection] = useState<PeerConnection | null>(null);
    const [opponentProgress, setOpponentProgress] = useState<PlayerProgress[]>([]);
    const [isConnecting, setIsConnecting] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [gameEnded, setGameEnded] = useState(false);

    const fetchRoomData = useCallback(async () => {
        try {
            const roomData = await getRoom(roomId);
            if (roomData) {
                setRoom(roomData);
            } else {
                setError('ルームが見つかりませんでした');
            }
        } catch (err) {
            console.error('ルーム取得エラー:', err);
            setError('ルーム情報の取得中にエラーが発生しました');
        }
    }, [roomId]);

    useEffect(() => {
        fetchRoomData();
    }, [fetchRoomData]);

    const {
        text,
        input,
        progress,
        isCompleted,
        handleInput,
        calculateWPM
    } = useTypingGame(room?.text || '');

    // WebRTC接続のセットアップ
    useEffect(() => {
        // 実装省略 - MultiplayerGame.tsxの実装と類似
    }, [roomId, playerId, isHost, userId]);

    // 進捗状況の更新と送信
    useEffect(() => {
        // 実装省略 - MultiplayerGame.tsxの実装と類似
    }, [progress, isCompleted]);

    const exitGame = useCallback(async () => {
        // 実装省略 - MultiplayerGame.tsxの実装と類似
    }, [roomId, playerId, isHost]);

    return {
        text,
        input,
        progress,
        isCompleted,
        handleInput,
        calculateWPM,
        opponentProgress,
        isConnecting,
        error,
        gameEnded,
        exitGame
    };
};
