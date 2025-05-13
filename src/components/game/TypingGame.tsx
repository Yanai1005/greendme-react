import { useState } from 'react';
import { useTypingGame } from '../../hooks/useTypingGame';
import TextDisplay from './TextDisplay';
import ProgressBar from './ProgressBar';
import { DIFFICULTY_LEVELS, getRandomText } from '../../constants/gameTexts';

const TypingGame = () => {
    const [selectedLevel, setSelectedLevel] = useState<string>('medium');

    const initialText = DIFFICULTY_LEVELS.MEDIUM.text;
    const {
        text,
        input,
        elapsedTime,
        progress,
        isCompleted,
        handleInput,
        resetGame,
        changeText,
        calculateWPM,
        calculateAccuracy
    } = useTypingGame(initialText);

    // 難易度選択
    const handleDifficultyChange = (level: string) => {
        setSelectedLevel(level);
        const difficulty = Object.values(DIFFICULTY_LEVELS).find(d => d.id === level);
        if (difficulty) {
            changeText(difficulty.text);
        }
    };

    const generateRandomText = () => {
        changeText(getRandomText(selectedLevel));
    };

    const formattedTime = () => {
        const totalSeconds = Math.floor(elapsedTime / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    return (
        <div>
            <h2>タイピングゲーム</h2>

            <div>
                <div>
                    <span>時間: {formattedTime()}</span>
                    <span>WPM: {calculateWPM()}</span>
                    <span>正確度: {calculateAccuracy()}%</span>
                </div>

                <ProgressBar progress={progress} />
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
                    <h3>結果</h3>
                    <p>タイピング完了時間: {(elapsedTime / 1000).toFixed(2)}秒</p>
                    <p>WPM (Words Per Minute): {calculateWPM()}</p>
                    <p>正確度: {calculateAccuracy()}%</p>
                </div>
            )}

            <div>
                <button onClick={resetGame}>リセット</button>
                <button onClick={generateRandomText}>ランダムテキスト</button>

                <div>
                    {Object.values(DIFFICULTY_LEVELS).map(level => (
                        <button
                            key={level.id}
                            onClick={() => handleDifficultyChange(level.id)}
                        >
                            {level.label}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default TypingGame;
