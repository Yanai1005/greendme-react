import { useState } from 'react';
import { getRoom, updatePlayerCount } from '../../services/firebase/rooms';
import { addPlayerToRoom } from '../../services/firebase/players';

interface JoinRoomProps {
    playerId: string;
    playerName: string;
    roomId: string;
    onRoomJoined: (roomId: string, playerId: string) => void;
    onCancel: () => void;
}

const JoinRoom = ({ playerId, playerName, roomId, onRoomJoined, onCancel }: JoinRoomProps) => {
    const [isJoining, setIsJoining] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleJoinRoom = async () => {
        setIsJoining(true);
        setError(null);

        try {
            // ルーム情報を取得
            const room = await getRoom(roomId);

            if (!room) {
                setError('ルームが見つかりませんでした。');
                return;
            }

            if (room.status !== 'waiting') {
                setError('このルームは既にゲームが開始されているか、閉じられています。');
                return;
            }

            // プレイヤー情報を保存
            const roomPlayerId = await addPlayerToRoom({
                roomId,
                userId: playerId,
                userName: playerName,
                progress: 0,
                wpm: 0,
                accuracy: 0,
                isCompleted: false
            });

            // プレイヤーカウントを更新
            await updatePlayerCount(roomId, (room.playerCount || 0) + 1);

            // 親コンポーネントに通知
            onRoomJoined(roomId, roomPlayerId);
        } catch (error) {
            console.error('ルーム参加エラー:', error);
            setError('ルームへの参加中にエラーが発生しました。もう一度お試しください。');
        } finally {
            setIsJoining(false);
        }
    };

    return (
        <div>
            <h2>ルームに参加</h2>

            <p>ルームID: {roomId}</p>

            <button
                onClick={handleJoinRoom}
                disabled={isJoining}
            >
                {isJoining ? '参加中...' : '参加する'}
            </button>

            <button
                onClick={onCancel}
                disabled={isJoining}
            >
                キャンセル
            </button>

            {error && <p style={{ color: 'red' }}>{error}</p>}
        </div>
    );
};

export default JoinRoom;
