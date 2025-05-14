interface GameResultsProps {
    players: Array<{
        userId: string;
        userName: string;
        progress: number;
        wpm: number;
        isCompleted: boolean;
    }>;
    onExit: () => void;
}

const GameResults = ({ players, onExit }: GameResultsProps) => {
    // WPM順にソート
    const sortedPlayers = [...players]
        .filter(player => player.isCompleted)
        .sort((a, b) => b.wpm - a.wpm);

    return (
        <div>
            <h2>ゲーム結果</h2>

            <div>
                <h3>順位</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr>
                            <th style={{ textAlign: 'left' }}>順位</th>
                            <th style={{ textAlign: 'left' }}>プレイヤー</th>
                            <th style={{ textAlign: 'right' }}>WPM</th>
                            <th style={{ textAlign: 'right' }}>完了状態</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedPlayers.map((player, index) => (
                            <tr key={player.userId}>
                                <td>{index + 1}</td>
                                <td>{player.userName}</td>
                                <td style={{ textAlign: 'right' }}>{player.wpm}</td>
                                <td style={{ textAlign: 'right' }}>
                                    {player.isCompleted ? '完了' : `${player.progress.toFixed(1)}%`}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div>
                <h3>完了していないプレイヤー</h3>
                {players.filter(p => !p.isCompleted).length === 0 ? (
                    <p>全員完了しました！</p>
                ) : (
                    <ul>
                        {players.filter(p => !p.isCompleted).map(player => (
                            <li key={player.userId}>
                                {player.userName} - 進捗: {player.progress.toFixed(1)}%
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <button onClick={onExit}>
                ルームを退出
            </button>
        </div>
    );
};

export default GameResults;
