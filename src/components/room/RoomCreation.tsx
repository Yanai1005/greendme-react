import { useState } from 'react';
import { createRoom } from '../../services/firebase/rooms';
import { addPlayerToRoom } from '../../services/firebase/players';
import { DIFFICULTY_LEVELS, getRandomText } from '../../constants/gameTexts';

interface RoomCreationProps {
    playerId: string;
    playerName: string;
    onRoomCreated: (roomId: string, playerId: string) => void;
}

const RoomCreation = ({ playerId, playerName, onRoomCreated }: RoomCreationProps) => {
    const [difficulty, setDifficulty] = useState('medium');
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleCreateRoom = async () => {
        setIsCreating(true);
        setError(null);

        try {
            // 難易度に基づいてランダムテキストを生成
            const text = getRandomText(difficulty);

            // ルームを作成
            const roomId = await createRoom({
                createdBy: playerId,
                creatorName: playerName,
                status: 'waiting',
                text,
                difficulty,
                playerCount: 1
            });

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

            // 親コンポーネントに通知
            onRoomCreated(roomId, roomPlayerId);
        } catch (error) {
            console.error('部屋作成エラー:', error);
            setError('部屋の作成中にエラーが発生しました。もう一度お試しください。');
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div>
            <h2>新しい対戦ルームを作成</h2>

            <div>
                <label>
                    難易度を選択:
                    <select
                        value={difficulty}
                        onChange={(e) => setDifficulty(e.target.value)}
                        disabled={isCreating}
                    >
                        {Object.values(DIFFICULTY_LEVELS).map(level => (
                            <option key={level.id} value={level.id}>
                                {level.label}
                            </option>
                        ))}
                    </select>
                </label>
            </div>

            <button
                onClick={handleCreateRoom}
                disabled={isCreating}
            >
                {isCreating ? '作成中...' : 'ルームを作成'}
            </button>

            {error && <p style={{ color: 'red' }}>{error}</p>}
        </div>
    );
};

export default RoomCreation;
