import { useEffect } from 'react';
import { useRoomState } from '../../hooks/useRoomState';
import { useWebRTC } from '../../hooks/useWebRTC';
import { useTypingGame } from '../../hooks/useTypingGame';
import WaitingScreen from './WaitingScreen';
import GameScreen from './GameScreen';
import GameResult from './GameResult';
import ConnectionStatus from '../common/ConnectionStatus';

type TypingGameProps = {
    roomId: string;
    userId: string;
    userName: string;
};

const TypingGame = (props: TypingGameProps) => {
    const { roomId, userId, userName } = props;

    const {
        room,
        isHost,
        otherPlayerId,
        isReady,
        bothPlayersReady,
        shouldStartWebRTC,
        handlePeerMessage
    } = useRoomState({ roomId, userId });

    const {
        isConnected,
        connectionError,
        dataChannel,
        resetConnection,
        connectionState,
    } = useWebRTC({
        roomId,
        userId,
        otherPlayerId,
        isHost,
        bothPlayersReady,
        shouldStartConnection: shouldStartWebRTC
    });

    // メッセージ受信ハンドラを設定
    useEffect(() => {
        if (dataChannel.current) {
            dataChannel.current.onmessage = (event) => {
                console.log(" Message received via WebRTC:", JSON.parse(event.data).type);
                handlePeerMessage(event.data);
            };
        }
    }, [dataChannel, handlePeerMessage]);

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
        dataChannel,
        otherPlayerId,
        room
    });

    if (!room) {
        return (
            <div className="typing-game-loading">
                <div className="text-center">
                    <div className="loading-spinner">🔄</div>
                    <h3>ルーム情報を読み込み中...</h3>
                    <p>少々お待ちください</p>
                </div>
            </div>
        );
    }

    const getConnectionStatusMessage = () => {
        if (!otherPlayerId) {
            return " 対戦相手を待機中...";
        }

        if (!bothPlayersReady) {
            return " 両プレイヤーの準備完了を待機中...";
        }

        switch (connectionState) {
            case 'idle':
                return " 接続待機中...";
            case 'initializing':
                return " WebRTC接続を初期化中...";
            case 'connecting':
                return " P2P接続を確立中...";
            case 'connected':
                return " P2P接続確立済み";
            case 'failed':
                return " 接続失敗";
            default:
                return " 不明な状態";
        }
    };

    return (
        <div className="typing-game">
            <h2> Gitコマンドタイピングゲーム</h2>

            <div className="game-status-panel" style={{
                backgroundColor: '#f8f9fa',
                padding: '15px',
                borderRadius: '8px',
                marginBottom: '20px',
                border: '1px solid #dee2e6'
            }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', fontSize: '14px' }}>
                    <div><strong> ゲーム状態:</strong> {
                        gameStatus === 'waiting' ? '待機中' :
                            gameStatus === 'ready' ? '準備完了' :
                                gameStatus === 'playing' ? 'ゲーム中' : '終了'
                    }</div>
                    <div><strong> プレイヤー:</strong> {userName} ({isHost ? 'ホスト' : 'ゲスト'})</div>
                    <div><strong> 部屋ID:</strong> {roomId.substring(0, 8)}...</div>
                    <div><strong> 参加者:</strong> {room.participants.length}/2</div>
                </div>

                <div style={{ marginTop: '10px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', fontSize: '14px' }}>
                    <div><strong> 対戦相手:</strong> {
                        otherPlayerId
                            ? `接続中 [${otherPlayerId.substring(0, 8)}...]`
                            : '待機中...'
                    }</div>
                    <div><strong>接続状態:</strong> {getConnectionStatusMessage()}</div>
                    <div><strong> 準備状態:</strong> {isReady ? '準備完了' : '未準備'}</div>
                    <div><strong> 進捗:</strong> {getCurrentQuestionNumber()}/{getTotalQuestionCount()} ({totalProgress}%)</div>
                </div>
            </div>

            {(connectionError || (otherPlayerId && bothPlayersReady && !isConnected && connectionState !== 'idle')) && (
                <ConnectionStatus
                    status={connectionError ? 'failed' : 'connecting'}
                    onRetry={resetConnection}
                    retryCount={0}
                    maxRetries={3}
                />
            )}

            デバッグ情報（開発時のみ表示）
            {process.env.NODE_ENV === 'development' && (
                <details style={{ marginBottom: '20px', fontSize: '12px', color: '#666' }}>
                    <summary>🔧 デバッグ情報</summary>
                    <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f1f3f4', borderRadius: '4px' }}>
                        <div>Other Player ID: {otherPlayerId || 'null'}</div>
                        <div>Both Players Ready: {bothPlayersReady.toString()}</div>
                        <div>Should Start WebRTC: {shouldStartWebRTC.toString()}</div>
                        <div>Connection State: {connectionState}</div>
                        <div>Is Connected: {isConnected.toString()}</div>
                        <div>Connection Error: {connectionError || 'none'}</div>
                        <div>Data Channel Ready: {dataChannel.current?.readyState || 'null'}</div>
                    </div>
                </details>
            )}

            {/* ゲーム画面 */}
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
                    room={room}
                    userId={userId}
                />
            )}

            {bothPlayersReady && (
                <div style={{
                    marginTop: '20px',
                    padding: '15px',
                    backgroundColor: isConnected ? '#d4edda' : '#fff3cd',
                    border: `1px solid ${isConnected ? '#c3e6cb' : '#ffeaa7'}`,
                    borderRadius: '8px',
                    fontSize: '14px'
                }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
                        {isConnected ? ' リアルタイム通信' : ' 接続中'}
                    </div>
                    <div>
                        {isConnected
                            ? 'P2P接続でリアルタイムに進捗が同期されます'
                            : 'P2P接続を確立中です...少々お待ちください'
                        }
                    </div>
                </div>
            )}
        </div>
    );
};

export default TypingGame;
