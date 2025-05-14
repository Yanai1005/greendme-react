import { useState } from 'react';
import TypingGame from './components/game/TypingGame';
import MultiplayerPage from './pages/MultiplayerPage';

const App = () => {
  const [mode, setMode] = useState<'single' | 'multiplayer'>('single');
  const [playerName, setPlayerName] = useState<string>('ゲスト');
  const [playerId] = useState<string>(() => {
    const storedId = localStorage.getItem('playerId');
    if (storedId) return storedId;

    const newId = `player_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem('playerId', newId);
    return newId;
  });

  return (
    <div>
      <header>
        <h1>タイピングスキル向上ゲーム</h1>
        <div>
          <label>
            プレイヤー名:
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="プレイヤー名"
            />
          </label>
        </div>
        <div>
          <button
            onClick={() => setMode('single')}
            style={{ fontWeight: mode === 'single' ? 'bold' : 'normal' }}
          >
            シングルプレイ
          </button>
          <button
            onClick={() => setMode('multiplayer')}
            style={{ fontWeight: mode === 'multiplayer' ? 'bold' : 'normal' }}
          >
            マルチプレイ
          </button>
        </div>
      </header>

      {mode === 'single' ? (
        <TypingGame />
      ) : (
        <MultiplayerPage
          playerId={playerId}
          playerName={playerName}
        />
      )}

      <footer>
        <p>© 2025 GreenDMe タイピングゲーム</p>
      </footer>
    </div>
  );
};

export default App;
