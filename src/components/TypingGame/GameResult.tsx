type GameResultProps = {
    isNotFoundEnding: boolean;
    typingText: string;
    endReason?: string | null;
};

const GameResult = (props: GameResultProps) => {
    const { isNotFoundEnding, typingText, endReason } = props;

    if (isNotFoundEnding || typingText === 'git push -f origin main') {
        return (
            <div className="game-result bg-gray-100 p-6 rounded-lg shadow-md text-center">
                <h3 className="text-xl font-bold text-red-600 mb-2">Not Found</h3>
                <p className="mb-4">このコマンドは実行できません</p>
                {endReason && <p className="text-sm text-gray-600 mt-2 mb-4">{endReason}</p>}

                <div className="mt-4 flex flex-col items-center">
                    <p className="text-sm font-medium mb-3">カメラで読み取ってください:</p>
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
            <h3 className="text-xl font-bold text-green-600 mb-2">ゲーム終了</h3>
            <p className="mb-4">おつかれさまでした！</p>
        </div>
    );
};

export default GameResult;
