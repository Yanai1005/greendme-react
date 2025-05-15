import React, { useState } from 'react';
import { createRoom } from '../services/roomService';

interface CreateRoomProps {
    userId: string;
    onRoomCreated: (roomId: string) => void;
    onCancel: () => void;
}

const CreateRoom: React.FC<CreateRoomProps> = ({ userId, onRoomCreated, onCancel }) => {
    const [roomName, setRoomName] = useState<string>('');
    const [isCreating, setIsCreating] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!roomName.trim()) {
            setError('部屋名を入力してください');
            return;
        }

        try {
            setIsCreating(true);
            setError(null);

            const roomId = await createRoom(roomName, userId);
            onRoomCreated(roomId);
        } catch (err) {
            setError('部屋の作成に失敗しました');
            console.error('Error creating room:', err);
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div className="create-room">
            <h2>新しい部屋を作成</h2>

            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label htmlFor="roomName">部屋名:</label>
                    <input
                        type="text"
                        id="roomName"
                        value={roomName}
                        onChange={(e) => setRoomName(e.target.value)}
                        disabled={isCreating}
                        placeholder="部屋名を入力してください"
                        required
                    />
                </div>

                {error && <p className="error">{error}</p>}

                <div className="form-actions">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={isCreating}
                    >
                        キャンセル
                    </button>
                    <button
                        type="submit"
                        disabled={isCreating || !roomName.trim()}
                    >
                        {isCreating ? '作成中...' : '作成'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default CreateRoom; 
