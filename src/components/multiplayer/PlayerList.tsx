interface PlayerListProps {
    players: Array<{
        userId: string;
        userName: string;
        progress: number;
        wpm: number;
        isCompleted: boolean;
    }>;
    currentUserId: string;
}

const PlayerList = ({ players, currentUserId }: PlayerListProps) => {
    // 進捗順にソート
    const sortedPlayers = [...players].sort((a, b) => b.progress - a.progress);

    return (
        <div>
            <h3>プレイヤー進捗</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {sortedPlayers.map((player, index) => (
                    <div
                        key={player.userId}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            fontWeight: player.userId === currentUserId ? 'bold' : 'normal'
                        }}
                    >
                        <div style={{ width: '20px' }}>{index + 1}.</div>
                        <div style={{ width: '120px' }}>{player.userName}</div>
                        <div style={{ width: '60px' }}>{player.wpm} WPM</div>
                        <div style={{ flex: 1 }}>
                            <div style={{
                                width: '100%',
                                height: '10px',
                                backgroundColor: '#eee',
                                borderRadius: '5px',
                                overflow: 'hidden'
                            }}>
                                <div style={{
                                    width: `${player.progress}%`,
                                    height: '100%',
                                    backgroundColor: player.isCompleted ? '#4CAF50' : '#2196F3',
                                    transition: 'width 0.3s ease'
                                }} />
                            </div>
                        </div>
                        <div style={{ width: '50px', textAlign: 'right' }}>
                            {player.progress.toFixed(1)}%
                        </div>
                        {player.isCompleted && (
                            <div style={{ marginLeft: '8px', color: '#4CAF50' }}>完了</div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default PlayerList;
