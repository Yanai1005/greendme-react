interface ProgressBarProps {
    progress: number;
}

const ProgressBar = (props: ProgressBarProps) => {
    return (
        <div>
            <progress value={props.progress} max="100" />
            <span>{props.progress.toFixed(1)}%</span>
        </div>
    );
};

export default ProgressBar;
