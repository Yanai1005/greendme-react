type GameResultProps = {
    isNotFoundEnding: boolean;
    typingText: string;
    endReason?: string | null;
    room: any;
    userId: string;
};

const GameResult = (props: GameResultProps) => {
    const { isNotFoundEnding, typingText, room } = props;

    const isGameCompleted = () => {
        if (!room?.gameState?.players) return false;
        const players = room.gameState.players;
        const playerIds = Object.keys(players);

        return playerIds.some(playerId => players[playerId]?.completed);
    };

    if (isNotFoundEnding || typingText === 'git push -f origin main' || isGameCompleted()) {
        return (
            <div className="game-result bg-gray-100 p-6 rounded-lg shadow-md text-center">
                <div className="mt-4 flex flex-col items-center">
                    <p className="text-sm font-medium mb-3">Errorが発生しました</p>
                    <img
                        src="https://qr-official.line.me/gs/M_746wkmkl_GW.png"
                        alt="LINE QR Code"
                        className="w-48 h-48 mx-auto border border-gray-300"
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="game-result bg-gray-100 p-6 rounded-lg shadow-md text-center">
            <h3 className="text-2xl font-bold text-green-600 mb-4">ゲーム終了</h3>
            <p className="text-lg">おつかれさまでした！</p>
        </div>
    );
};

export default GameResult;
