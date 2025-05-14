import { useState, useEffect, useRef } from 'react';
import { useTypingGame } from '../../hooks/useTypingGame';
import { PeerConnection } from '../../services/webrtc/PeerConnection';
import { getRoom, subscribeToRoom, updateRoomStatus } from '../../services/firebase/rooms';
import { subscribeToPlayersInRoom, updatePlayerStatus, removePlayerFromRoom } from '../../services/firebase/players';
import TextDisplay from '../game/TextDisplay';
import ProgressBar from '../game/ProgressBar';
import PlayerList from './PlayerList';
import GameResults from './GameResults';
import type { Room, Player } from '../../types/firebase';

interface MultiplayerGameProps {
    roomId: string;
    playerId: string;
    isHost: boolean;
    userId: string;
    onExitGame: () => void;
}

interface PlayerProgress {
    playerId: string;
    userId: string;
    userName: string;
    progress: number;
    wpm: number;
    isCompleted: boolean;
}

const UPDATE_INTERVAL = 500; // ミリ秒ごとに状態を更新

const MultiplayerGame = ({ roomId, playerId, isHost, userId, onExitGame }: MultiplayerGameProps) => {
    const [room, setRoom] = useState<Room | null>(null);
    const [roomPlayers, setRoomPlayers] = useState<Player[]>([]);
    const [peerConnection, setPeerConnection] = useState<PeerConnection | null>(null);
    const [playerProgress, setPlayerProgress] = useState<PlayerProgress[]>([]);
    const [isConnecting, setIsConnecting] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [gameEnded, setGameEnded] = useState(false);

    const lastUpdateRef = useRef<number>(0);
    const roomPlayerIdRef = useRef<string>(playerId);

    // ゲーム状態
    const {
        text,
        input,
        progress,
        elapsedTime,
        isCompleted,
        handleInput,
        calculateWPM,
        calculateAccuracy
    } = useTypingGame(room?.text || '');

    // ルームおよびプレイヤー情報の取得
    useEffect(() => {
        const roomUnsubscribe = subscribeToRoom(roomId, (roomData) => {
            setRoom(roomData);

            // ルームが完了状態になったらゲーム終了
            if (roomData?.status === 'completed') {
                setGameEnded(true);
            }
        });

        const playersUnsubscribe = subscribeToPlayersInRoom(roomId, (players) => {
            setRoomPlayers(players);

            // プレイヤーの進捗状況を更新
            const progressData = players.map(player => ({
                playerId: player.id || '',
                userId: player.userId,
                userName: player.userName,
                progress: player.progress,
                wpm: player.wpm,
                isCompleted: player.isCompleted
            }));

            setPlayerProgress(progressData);

            // すべてのプレイヤーが完了したらゲーム終了
            const allCompleted = players.length > 0 && players.every(p => p.isCompleted);
            if (allCompleted && isHost && room?.status !== 'completed') {
                updateRoomStatus(roomId, 'completed').catch(console.error);
            }
        });

        return () => {
            roomUnsubscribe();
            playersUnsubscribe();
        };
    }, [roomId, isHost, room?.status]);

    // WebRTC接続のセットアップ
    useEffect(() => {
        const setupPeerConnection = async () => {
            try {
                setIsConnecting(true);

                // ルーム情報を取得
                const roomData = await getRoom(roomId);
                if (!roomData) {
                    throw new Error('ルームが見つかりませんでした');
                }

                // WebRTC接続を初期化
                const connection = new PeerConnection(roomId, playerId);

                // データチャネル設定
                if (isHost) {
                    connection.createDataChannel();
                    connection.createOffer();

                    // ホストは他のプレイヤーからの接続を監視
                    roomPlayers.forEach(player => {
                        if (player.userId !== userId) {
                            connection.listenForSignals(player.id);
                        }
                    });
                } else {
                    // 参加者はホストからの信号を監視
                    connection.listenForSignals();
                }

                // データ受信コールバック
                connection.onData((data) => {
                    if (data.type === 'progress') {
                        setPlayerProgress(prev => {
                            const playerIndex = prev.findIndex(p => p.userId === data.userId);
                            if (playerIndex >= 0) {
                                const updated = [...prev];
                                updated[playerIndex] = {
                                    ...updated[playerIndex],
                                    progress: data.progress,
                                    wpm: data.wpm,
                                    isCompleted: data.isCompleted
                                };
                                return updated;
                            }
                            return prev;
                        });
                    }
                });

                setPeerConnection(connection);
                setIsConnecting(false);
            } catch (error) {
                console.error('WebRTC接続エラー:', error);
                setError('他のプレイヤーとの接続中にエラーが発生しました。');
                setIsConnecting(false);
            }
        };

        if (roomId && playerId && roomPlayers.length > 0) {
            setupPeerConnection();
        }

        return () => {
            if (peerConnection) {
                peerConnection.cleanup();
            }
        };
    }, [roomId, playerId, isHost, userId, roomPlayers.length]);

    // 進捗状況の更新と送信
    useEffect(() => {
        const updateProgress = async () => {
            const now = Date.now();

            // 一定間隔ごとに更新
            if (now - lastUpdateRef.current < UPDATE_INTERVAL) {
                return;
            }

            lastUpdateRef.current = now;

            try {
                // Firestoreにプレイヤーの状態を更新
                const wpm = calculateWPM();
                await updatePlayerStatus(roomPlayerIdRef.current, {
                    progress,
                    wpm,
                    accuracy: calculateAccuracy(),
                    isCompleted,
                    ...(isCompleted ? { completedAt: now } : {})
                });

                // WebRTCでリアルタイム更新
                if (peerConnection) {
                    peerConnection.sendData({
                        type: 'progress',
                        userId,
                        progress,
                        wpm,
                        isCompleted
                    });
                }
            } catch (error) {
                console.error('進捗更新エラー:', error);
            }
        };

        // 接続完了後に更新を開始
        if (!isConnecting && !error) {
            const intervalId = setInterval(updateProgress, 100);
            return () => clearInterval(intervalId);
        }
    }, [progress, isCompleted, calculateWPM, calculateAccuracy, isConnecting, error, peerConnection, userId]);

    // ゲーム終了時のクリーンアップ
    const handleExitGame = async () => {
        try {
            // WebRTC接続をクリーンアップ
            if (peerConnection) {
                await peerConnection.cleanup();
            }

            // プレイヤーをルームから削除
            await removePlayerFromRoom(playerId);

            // ホストの場合はルームのステータスを更新
            if (isHost && room && roomPlayers.length <= 1) {
                await updateRoomStatus(roomId, 'completed');
            }

            onExitGame();
        } catch (error) {
            console.error('ゲーム終了エラー:', error);
        }
    };

    if (isConnecting) {
        return <div>他のプレイヤーと接続中...</div>;
    }

    if (error) {
        return (
            <div>
                <p style={{ color: 'red' }}>{error}</p>
                <button onClick={handleExitGame}>ゲームを終了</button>
            </div>
        );
    }

    if (!room) {
        return <div>ルーム情報を読み込み中...</div>;
    }

    const formattedTime = () => {
        const totalSeconds = Math.floor(elapsedTime / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    return (
        <div>
            <h2>オンライン対戦タイピングゲーム</h2>

            {gameEnded ? (
                <GameResults
                    players={playerProgress}
                    onExit={handleExitGame}
                />
            ) : (
                <>
                    <div>
                        <div>
                            <span>時間: {formattedTime()}</span>
                            <span>WPM: {calculateWPM()}</span>
                            <span>正確度: {calculateAccuracy()}%</span>
                        </div>

                        <ProgressBar progress={progress} />

                        <PlayerList
                            players={playerProgress}
                            currentUserId={userId}
                        />
                    </div>

                    <div>
                        <TextDisplay text={text} input={input} />
                        <textarea
                            value={input}
                            onChange={handleInput}
                            placeholder="ここにタイプしてください..."
                            disabled={isCompleted}
                            autoFocus
                        />
                    </div>

                    {isCompleted && (
                        <div>
                            <h3>完了！</h3>
                            <p>他のプレイヤーが終了するのを待っています...</p>
                        </div>
                    )}

                    <button onClick={handleExitGame}>
                        ゲームを中断して退出
                    </button>
                </>
            )}
        </div>
    );
};

export default MultiplayerGame;
