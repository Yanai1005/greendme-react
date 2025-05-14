import { useState } from 'react';
import RoomCreation from '../components/room/RoomCreation';
import RoomListing from '../components/room/RoomListing';
import RoomDetails from '../components/room/RoomDetails';
import JoinRoom from '../components/room/JoinRoom';
import MultiplayerGame from '../components/multiplayer/MultiplayerGame';

interface MultiplayerPageProps {
    playerId: string;
    playerName: string;
}

type PageState = 'list' | 'create' | 'join' | 'room' | 'game';

const MultiplayerPage = ({ playerId, playerName }: MultiplayerPageProps) => {
    const [pageState, setPageState] = useState<PageState>('list');
    const [roomId, setRoomId] = useState<string>('');
    const [roomPlayerId, setRoomPlayerId] = useState<string>('');
    const [isHost, setIsHost] = useState(false);
    const [selectedRoomId, setSelectedRoomId] = useState<string>('');

    const handleCreateRoom = (newRoomId: string, newPlayerId: string) => {
        setRoomId(newRoomId);
        setRoomPlayerId(newPlayerId);
        setIsHost(true);
        setPageState('room');
    };

    const handleJoinRoom = (roomToJoinId: string) => {
        setSelectedRoomId(roomToJoinId);
        setPageState('join');
    };

    const handleRoomJoined = (joinedRoomId: string, joinedPlayerId: string) => {
        setRoomId(joinedRoomId);
        setRoomPlayerId(joinedPlayerId);
        setIsHost(false);
        setPageState('room');
    };

    const handleStartGame = () => {
        setPageState('game');
    };

    const handleLeaveRoom = () => {
        setRoomId('');
        setRoomPlayerId('');
        setIsHost(false);
        setPageState('list');
    };

    const handleExitGame = () => {
        setRoomId('');
        setRoomPlayerId('');
        setIsHost(false);
        setPageState('list');
    };

    return (
        <div>
            <h1>タイピング対戦</h1>

            {pageState === 'list' && (
                <div>
                    <button onClick={() => setPageState('create')}>
                        新しいルームを作成
                    </button>

                    <RoomListing onJoinRoom={handleJoinRoom} />
                </div>
            )}

            {pageState === 'create' && (
                <RoomCreation
                    playerId={playerId}
                    playerName={playerName}
                    onRoomCreated={handleCreateRoom}
                />
            )}

            {pageState === 'join' && (
                <JoinRoom
                    playerId={playerId}
                    playerName={playerName}
                    roomId={selectedRoomId}
                    onRoomJoined={handleRoomJoined}
                    onCancel={() => setPageState('list')}
                />
            )}

            {pageState === 'room' && (
                <RoomDetails
                    roomId={roomId}
                    isHost={isHost}
                    onStartGame={handleStartGame}
                    onLeaveRoom={handleLeaveRoom}
                />
            )}

            {pageState === 'game' && (
                <MultiplayerGame
                    roomId={roomId}
                    playerId={roomPlayerId}
                    isHost={isHost}
                    userId={playerId}
                    onExitGame={handleExitGame}
                />
            )}
        </div>
    );
};

export default MultiplayerPage;
