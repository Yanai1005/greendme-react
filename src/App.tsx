import { useState } from 'react';
import RoomList from './components/RoomList';
import CreateRoom from './components/CreateRoom';
import ChatRoom from './components/ChatRoom';
import TypingGame from './components/TypingGame';
import { randomMatch, joinRoom } from './services/roomService';

// 画面の状態を管理する型
type AppState = 'loading' | 'roomList' | 'createRoom' | 'chatRoom' | 'typingGame';

// ランダムなIDを生成する関数
const generateRandomId = () => {
  return 'guest-' + Math.random().toString(36).substring(2, 15);
};

function App() {
  const [userId] = useState<string>(generateRandomId());
  const [userName, setUserName] = useState<string>('ゲスト');
  const [appState, setAppState] = useState<AppState>('roomList');
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // 部屋を選択したとき
  const handleSelectRoom = async (roomId: string) => {
    try {
      setIsLoading(true);
      setError(null);

      // 部屋に参加
      await joinRoom(roomId, userId);
      console.log(`Successfully joined room: ${roomId}`);

      setSelectedRoomId(roomId);
      setAppState('typingGame'); // タイピングゲームに変更
    } catch (err) {
      console.error('Error joining room:', err);
      setError('部屋への参加に失敗しました。もう一度お試しください。');
    } finally {
      setIsLoading(false);
    }
  };

  // 部屋作成画面へ
  const handleCreateRoomClick = () => {
    setAppState('createRoom');
  };

  // 部屋が作成されたとき
  const handleRoomCreated = async (roomId: string) => {
    try {
      setIsLoading(true);
      setError(null);

      // 作成した部屋に参加（念のため）
      await joinRoom(roomId, userId);
      console.log(`Successfully joined created room: ${roomId}`);

      setSelectedRoomId(roomId);
      setAppState('typingGame'); // タイピングゲームに変更
    } catch (err) {
      console.error('Error joining created room:', err);
      setError('作成した部屋への参加に失敗しました。もう一度お試しください。');
    } finally {
      setIsLoading(false);
    }
  };

  // 部屋から退出したとき
  const handleLeaveRoom = () => {
    setSelectedRoomId('');
    setAppState('roomList');
  };

  // 部屋作成をキャンセルしたとき
  const handleCancelCreateRoom = () => {
    setAppState('roomList');
  };

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
      const roomId = await randomMatch(userId, userName);
      setSelectedRoomId(roomId);
      setAppState('typingGame');
    } catch (err) {
      console.error('Error in random matching:', err);
      setError('マッチングに失敗しました。もう一度お試しください。');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto max-w-2xl p-4">
      <h1 className="text-3xl font-bold mb-8 text-center">オンラインタイピングゲーム</h1>

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

      {/* 部屋一覧 */}
      {appState === 'roomList' && (
        <div>
          <div className="random-match-button mb-4">
            <button
              onClick={handleRandomMatch}
              disabled={isLoading}
              className="w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            >
              {isLoading ? 'マッチング中...' : 'ランダムマッチング'}
            </button>
          </div>

          <div className="divider my-4 text-center">または</div>

          <RoomList
            onSelectRoom={handleSelectRoom}
            onCreateNewRoom={handleCreateRoomClick}
          />
        </div>
      )}

      {/* 部屋作成 */}
      {appState === 'createRoom' && (
        <CreateRoom
          userId={userId}
          onRoomCreated={handleRoomCreated}
          onCancel={handleCancelCreateRoom}
        />
      )}

      {/* チャットルーム */}
      {appState === 'chatRoom' && (
        <ChatRoom
          roomId={selectedRoomId}
          userId={userId}
          userName={userName}
          onLeaveRoom={handleLeaveRoom}
        />
      )}

      {/* タイピングゲーム */}
      {appState === 'typingGame' && (
        <div>
          <TypingGame
            roomId={selectedRoomId}
            userId={userId}
            userName={userName}
          />
          <button
            onClick={handleLeaveRoom}
            className="mt-4 bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded"
          >
            ゲームを退出
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
