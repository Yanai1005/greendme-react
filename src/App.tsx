import { useState } from 'react';
import TypingGame from './components/TypingGame';
import { randomMatch } from './services/room';

// ランダムなIDを生成する関数
const generateRandomId = () => {
  return 'guest-' + Math.random().toString(36).substring(2, 15);
};

const App = () => {
  const [userId] = useState<string>(generateRandomId());
  const [userName, setUserName] = useState<string>('ゲスト');
  const [roomId, setRoomId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // ユーザー名の変更
  const handleUserNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUserName(e.target.value);
  };

  // ランダムマッチング
  const handleRandomMatch = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // ランダムマッチング実行
      const newRoomId = await randomMatch(userId, userName);
      setRoomId(newRoomId);
    } catch (err) {
      console.error('Error in random matching:', err);
      setError('マッチングに失敗しました。もう一度お試しください。');
    } finally {
      setIsLoading(false);
    }
  };

  // ゲームを終了して初期画面に戻る
  const handleLeaveGame = () => {
    setRoomId(null);
  };

  return (
    <div className="container mx-auto max-w-2xl p-4">
      <h1 className="text-3xl font-bold mb-8 text-center">オンラインタイピングゲーム</h1>

      {!roomId ? (
        <div className="setup-screen">
          {/* ユーザー名設定 */}
          <div className="user-settings mb-4">
            <label htmlFor="userName" className="mr-2">ユーザー名:</label>
            <input
              type="text"
              id="userName"
              value={userName}
              onChange={handleUserNameChange}
              className="border p-1 rounded"
              maxLength={20}
            />
          </div>

          {/* エラー表示 */}
          {error && (
            <div className="error-message mb-4 p-2 bg-red-100 text-red-700 rounded">
              {error}
            </div>
          )}

          {/* ランダムマッチングボタン */}
          <div className="random-match-button mb-4">
            <button
              onClick={handleRandomMatch}
              disabled={isLoading}
              className="w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            >
              {isLoading ? 'マッチング中...' : 'ランダムマッチング'}
            </button>
          </div>
        </div>
      ) : (
        <div className="game-screen">
          <TypingGame
            roomId={roomId}
            userId={userId}
            userName={userName}
          />
          <button
            onClick={handleLeaveGame}
            className="mt-4 bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded"
          >
            ゲームを退出
          </button>
        </div>
      )}
    </div>
  );
};

export default App;
