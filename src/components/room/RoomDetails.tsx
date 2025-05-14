import { useState, useEffect } from 'react';
import { subscribeToRoom, updateRoomStatus } from '../../services/firebase/rooms';
import { subscribeToPlayersInRoom } from '../../services/firebase/players';
import type { Room, Player } from '../../types/firebase';

interface RoomDetailsProps {
    roomId: string;
    isHost: boolean;
    onStartGame: () => void;
    onLeaveRoom: () => void;
}

const RoomDetails = ({ roomId, isHost, onStartGame, onLeaveRoom }: RoomDetailsProps) => {
    const [room, setRoom] = useState<Room | null>(null);
    const [players, setPlayers] = useState<Player[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setIsLoading(true);

        const roomUnsubscribe = subscribeToRoom(roomId, (roomData) => {
            setRoom(roomData);
            setIsLoading(false);

            // ルームがアクティブになったらゲームを開始
            if (roomData?.status === 'active') {
                onStartGame();
            }
        });

        const playersUnsubscribe = subscribeToPlayersInRoom(roomId, (playerList) => {
            setPlayers(playerList);
        });

        return () => {
            roomUnsubscribe();
            playersUnsubscribe();
        };
    }, [roomId, onStartGame]);

    const handleStartGame = async () => {
        if (!isHost || !room) return;

        try {
            await updateRoomStatus(roomId, 'active');
        } catch (error) {
            console.error('ゲーム開始エラー:', error);
            setError('ゲームの開始中にエラーが発生しました。');
        }
    };

    if (isLoading) {
        return <div>ルーム情報を読み込み中...</div>;
    }

    if (error) {
        return <div style={{ color: 'red' }}>{error}</div>;
    }

    if (!room) {
        return <div>ルームが見つかりません。</div>;
    }

    return (
        <div>
            <h2>ルーム: {room.creatorName}のルーム</h2>

            <div>
                <p>難易度: {room.difficulty}</p>
                <p>ステータス: {
                    room.status === 'waiting' ? '待機中' :
                        room.status === 'ready' ? '準備完了' :
                            room.status === 'active' ? 'ゲーム中' :
                                'ゲーム終了'
                }</p>
                <p>プレイヤー数: {players.length}</p>
            </div>

            <div>
                <h3>参加プレイヤー</h3>
                <ul>
                    {players.map((player) => (
                        <li key={player.id}>
                            {player.userName} {player.userId === room.createdBy ? '(ホスト)' : ''}
                        </li>
                    ))}
                </ul>
            </div>

            {isHost && room.status === 'waiting' && players.length > 1 && (
                <button onClick={handleStartGame}>
                    ゲームを開始
                </button>
            )}

            <button onClick={onLeaveRoom}>
                ルームを退出
            </button>
        </div>
    );
};

export default RoomDetails;
