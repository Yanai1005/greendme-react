import { useEffect } from 'react';
import { useRoomState } from '../../hooks/useRoomState';
import { useWebRTC } from '../../hooks/useWebRTC';
import { useTypingGame } from '../../hooks/useTypingGame';
import WaitingScreen from './WaitingScreen';
import GameScreen from './GameScreen';
import GameResult from './GameResult';
import ConnectionStatus from '../common/ConnectionStatus';

// propsの型定義
type TypingGameProps = {
    roomId: string;
    userId: string;
    userName: string;
};

const TypingGame = (props: TypingGameProps) => {
    const { roomId, userId, userName } = props;

    // ルーム状態を購読
    const {
        room,
        isHost,
        otherPlayerId,
        isReady,
        handlePeerMessage
    } = useRoomState({ roomId, userId });

    // WebRTC接続の管理
    const {
        isConnected,
        connectionError,
        dataChannel,
        resetConnection,
    } = useWebRTC({
        roomId,
        userId,
        otherPlayerId,
        isHost
    });

    // メッセージ受信ハンドラを設定
    useEffect(() => {
        if (dataChannel.current) {
            dataChannel.current.onmessage = (event) => {
                console.log("Message received:", event.data);
                handlePeerMessage(event.data);
            };
        }
    }, [dataChannel, handlePeerMessage]);

    // タイピングゲームのロジック
    const {
        typingText,
        inputText,
        progress,
        totalProgress,
        currentSetIndex,
        currentQuestionIndex,
        gameStatus,
        isNotFoundEnding,
        handleInputChange,
        toggleReady,
        getCurrentQuestionNumber,
        getTotalQuestionCount
    } = useTypingGame({
        roomId,
        userId,
        isReady,
        dataChannel
    });

    // ローディング状態
    if (!room) {
        return <div>ルーム情報を読み込み中...</div>;
    }

    return (
        <div className="typing-game">
            <h2>Gitコマンドタイピングゲーム</h2>

            <div className="game-status">
                ステータス: {
                    gameStatus === 'waiting' ? '待機中' :
                        gameStatus === 'ready' ? '準備完了' :
                            gameStatus === 'playing' ? 'ゲーム中' :
                                '終了'
                }
            </div>

            <div className="players-info">
                <div>プレイヤー: {userName} (あなた) [ID: {userId.substring(0, 8)}...]</div>
                <div>対戦相手: {
                    otherPlayerId
                        ? `接続中 [ID: ${otherPlayerId.substring(0, 8)}...]`
                        : '待機中...'
                }</div>
                <div>部屋ID: {roomId.substring(0, 8)}...</div>
                <div>参加者数: {room.participants.length}</div>
                <div>接続状態: {isConnected ? '接続済み' : '未接続'}</div>
                <div>準備状態: {isReady ? '準備完了' : '未準備'}</div>
                <div>問題: {getCurrentQuestionNumber()}/{getTotalQuestionCount()}</div>
                <div>全体進捗率: {totalProgress}%</div>
            </div>

            {connectionError && (
                <ConnectionStatus
                    status='failed'
                    onRetry={resetConnection}
                />
            )}

            {gameStatus === 'waiting' && (
                <WaitingScreen
                    isReady={isReady}
                    otherPlayerId={otherPlayerId}
                    room={room}
                    onToggleReady={toggleReady}
                />
            )}

            {gameStatus === 'playing' && (
                <GameScreen
                    typingText={typingText}
                    inputText={inputText}
                    onInputChange={handleInputChange}
                    progress={progress}
                    totalProgress={totalProgress}
                    otherPlayerId={otherPlayerId}
                    room={room}
                    currentQuestionIndex={currentQuestionIndex}
                    currentSetIndex={currentSetIndex}
                />
            )}

            {gameStatus === 'finished' && (
                <GameResult
                    isNotFoundEnding={isNotFoundEnding}
                    typingText={typingText}
                />
            )}
        </div>
    );
};

export default TypingGame;
