import { useState } from 'react';
import { RoomSetup } from './components/RoomSetup';
import { MultiplayerGame } from './components/MultiplayerGame';
import { SimpleP2P } from './services/SimpleP2P';

function App() {
  const [p2p, setP2P] = useState<SimpleP2P | null>(null);

  const handleConnectionEstablished = (connection: SimpleP2P) => {
    setP2P(connection);
  };

  return (
    <div className="container mx-auto max-w-2xl p-4">
      <h1 className="text-3xl font-bold mb-8 text-center">Multiplayer Game</h1>

      {!p2p ? (
        <RoomSetup onConnectionEstablished={handleConnectionEstablished} />
      ) : (
        <MultiplayerGame p2p={p2p} />
      )}
    </div>
  );
}

export default App;
