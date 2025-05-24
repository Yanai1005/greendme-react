import { useState, useEffect } from 'react';
import TypingGame from './components/TypingGame';
import { randomMatch } from './services/room';
// Firestore関連を追加
import { db } from './services/firebase/config';
import { collection, getDocs } from 'firebase/firestore';

const App = () => {
  // Firestoreから取得したユーザー一覧
  const [users, setUsers] = useState<{ id: string; name: string; password: string }[]>([]);
  const [selecting, setSelecting] = useState(true);
  const [selectedUser, setSelectedUser] = useState<{ id: string; name: string; password: string } | null>(null);
  const [inputPassword, setInputPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  // 選択されたユーザー情報
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [roomId, setRoomId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Firestoreからユーザー一覧を取得
  useEffect(() => {
    async function fetchUsers() {
      const snapshot = await getDocs(collection(db, "users"));
      const userList: { id: string; name: string; password: string }[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        userList.push({ id: doc.id, name: data.name || doc.id, password: data.password || "" });
      });
      setUsers(userList);
    }
    fetchUsers();
  }, []);

  // ユーザー選択・認証UI
  if (selecting) {
    return (
      <div className="container mx-auto max-w-2xl p-4">
        <h1 className="text-3xl font-bold mb-8 text-center">オンラインタイピングゲーム</h1>
        <h2 className="text-xl mb-4">ユーザーを選択してください</h2>
        {users.map((u) => (
          <div key={u.id} className="mb-2">
            <button
              className="bg-gray-200 hover:bg-gray-300 rounded px-4 py-2 mr-2"
              onClick={() => { setSelectedUser(u); setError(null); }}
            >
              {u.name} (ID: {u.id})
            </button>
          </div>
        ))}
        {/* ポップアップ式合言葉入力 */}
        {selectedUser && (
          <div
            className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50"
            onClick={() => { setSelectedUser(null); setInputPassword(""); setError(null); }}
          >
            <div
              className="bg-white p-8 rounded shadow-lg min-w-[260px] relative"
              onClick={e => e.stopPropagation()}
            >
              <div className="mb-4 text-lg font-bold">
                合言葉を入力してください（{selectedUser.name}）
              </div>
              <input
                type="text"
                value={inputPassword}
                onChange={(e) => setInputPassword(e.target.value)}
                className="border p-2 rounded w-3/4 mr-2"
                autoFocus
              />
              <button
                className="bg-blue-500 text-white px-4 py-2 rounded"
                onClick={() => {
                  if (inputPassword === selectedUser.password) {
                    setUserId(selectedUser.id);
                    setUserName(selectedUser.name);
                    setSelecting(false);
                  } else {
                    setError("合言葉が一致しません");
                  }
                }}
              >
                OK
              </button>
              <button
                className="absolute top-2 right-4 text-2xl text-gray-500"
                onClick={() => { setSelectedUser(null); setInputPassword(""); setError(null); }}
                aria-label="閉じる"
              >
                ×
              </button>
              {error && <div className="text-red-600 mt-3">{error}</div>}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ランダムマッチング
  const handleRandomMatch = async () => {
    try {
      setIsLoading(true);
      setError(null);
      if (!userId || !userName) {
        setError('ユーザーを選択してください');
        return;
      }
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
          {error && (
            <div className="error-message mb-4 p-2 bg-red-100 text-red-700 rounded">
              {error}
            </div>
          )}
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
            userId={userId!}
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
