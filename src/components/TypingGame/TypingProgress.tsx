type TypingProgressProps = {
    label: string;
    progress: number;
    totalProgress: number;
    progressColor?: string;
};

const TypingProgress = (props: TypingProgressProps) => {
    const {
        label,
        progress,
        totalProgress,
        progressColor = 'bg-blue-500'
    } = props;

    return (
        <div className="player-progress">
            <div className="player-name">{label}</div>

            {/* 現在の問題の進捗バー */}
            <div className="progress-bar">
                <div
                    className="progress-fill"
                    style={{ width: `${progress}%` }}
                ></div>
            </div>

            {/* 全体の進捗バー */}
            <div className="progress-bar" style={{ marginTop: '5px' }}>
                <div
                    className={`progress-fill ${progressColor}`}
                    style={{ width: `${totalProgress}%` }}
                ></div>
            </div>

            <div className="progress-text">{totalProgress}% (全体)</div>
        </div>
    );
};

export default TypingProgress;
