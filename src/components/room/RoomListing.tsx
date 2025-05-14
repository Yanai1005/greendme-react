import { useState, useEffect } from 'react';
import { subscribeToAvailableRooms } from '../../services/firebase/rooms';
import type { Room } from '../../types/firebase';

interface RoomListingProps {
    onJoinRoom: (roomId: string) => void;
}

const RoomListing = ({ onJoinRoom }: RoomListingProps) => {
    const [rooms, setRooms] = useState<Room[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setIsLoading(true);

        const unsubscribe = subscribeToAvailableRooms((availableRooms) => {
            setRooms(availableRooms);
            setIsLoading(false);
        });

        return () => {
            unsubscribe();
        };
    }, []);

    if (isLoading) {
        return <div>ルームを読み込み中...</div>;
    }

    if (error) {
        return <div style={{ color: 'red' }}>{error}</div>;
    }

    if (rooms.length === 0) {
        return <div>現在利用可能なルームはありません。新しいルームを作成してください。</div>;
    }

    return (
        <div>
            <h2>利用可能なルーム</h2>

            <div>
                {rooms.map((room) => (
                    <div key={room.id} style={{ border: '1px solid #ccc', padding: '10px', margin: '10px 0' }}>
                        <div>ホスト: {room.creatorName}</div>
                        <div>難易度: {room.difficulty}</div>
                        <div>プレイヤー数: {room.playerCount}</div>
                        <div>ステータス: {room.status === 'waiting' ? '待機中' : '準備完了'}</div>
                        <button onClick={() => onJoinRoom(room.id || '')}>
                            参加する
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default RoomListing;
