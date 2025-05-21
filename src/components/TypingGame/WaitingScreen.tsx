import type { Room } from '../../services/room/types';

type WaitingScreenProps = {
    isReady: boolean;
    otherPlayerId: string | null;
    room: Room;
    onToggleReady: () => Promise<void>;
};

const WaitingScreen = (props: WaitingScreenProps) => {
    const { isReady, otherPlayerId, room, onToggleReady } = props;

    return (
        <div className="waiting-screen">
            <p>
                {!otherPlayerId
                    ? '対戦相手を待っています...'
                    : '準備ができたらボタンを押してください'
                }
            </p>

            {otherPlayerId && (
                <div>
                    <button
                        onClick={onToggleReady}
                        className={`ready-button ${isReady ? 'ready' : ''}`}
                    >
                        {isReady ? '準備完了！' : '準備する'}
                    </button>

                    {isReady && room?.gameState?.players && (
                        <p>
                            対戦相手の準備状態: {
                                otherPlayerId &&
                                    room.gameState.players[otherPlayerId] &&
                                    room.gameState.players[otherPlayerId].ready
                                    ? '準備完了'
                                    : '準備中...'
                            }
                        </p>
                    )}
                </div>
            )}
        </div>
    );
};

export default WaitingScreen;
