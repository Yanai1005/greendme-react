import React, { useState, useEffect } from 'react';
import { getAvailableRooms } from '../services/roomService';
import type { Room } from '../services/roomService';

interface RoomListProps {
    onSelectRoom: (roomId: string) => void;
    onCreateNewRoom: () => void;
}

const RoomList: React.FC<RoomListProps> = ({ onSelectRoom, onCreateNewRoom }) => {
    const [rooms, setRooms] = useState<Room[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchRooms = async () => {
            try {
                setLoading(true);
                const availableRooms = await getAvailableRooms();
                console.log('Fetched rooms:', availableRooms);
                setRooms(availableRooms);
                setError(null);
            } catch (err) {
                console.error('Error fetching rooms:', err);
                setError('部屋の一覧を取得できませんでした。');
            } finally {
                setLoading(false);
            }
        };

        fetchRooms();
        // 定期的に部屋リストを更新
        const intervalId = setInterval(fetchRooms, 5000);

        return () => clearInterval(intervalId);
    }, []);

    return (
        <div className="room-list">
            <h2>利用可能な部屋</h2>

            <button
                onClick={onCreateNewRoom}
                className="create-room-btn"
            >
                新しい部屋を作成
            </button>

            {loading && <p>読み込み中...</p>}

            {error && <p className="error">{error}</p>}

            {!loading && rooms.length === 0 && !error && (
                <p>利用可能な部屋がありません。新しい部屋を作成してください。</p>
            )}

            <ul>
                {rooms.map((room) => (
                    <li key={room.id} onClick={() => onSelectRoom(room.id)} className="room-item">
                        <div className="room-name">{room.name}</div>
                        <div className="room-capacity">
                            {room.participants.length} / {room.maxParticipants} 人
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default RoomList; 
