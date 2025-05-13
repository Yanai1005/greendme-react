import { useState, useEffect } from 'react';
import { useTypingGame } from '../../hooks/useTypingGame';
import TextDisplay from './TextDisplay';
import ProgressBar from './ProgressBar';
import { DIFFICULTY_LEVELS, getRandomText } from '../../constants/gameTexts';
import { saveGameResult, getPlayerResults } from '../../services/firebase/firestore';
import type { GameResult } from '../../services/firebase/firestore';

const TypingGame = () => {
    const [selectedLevel, setSelectedLevel] = useState<string>('medium');
    const [playerName, setPlayerName] = useState<string>('ゲスト');
    const [playerId] = useState<string>(() => {
        const storedId = localStorage.getItem('playerId');
        if (storedId) return storedId;

        const newId = `player_${Math.random().toString(36).substring(2, 9)}`;
        localStorage.setItem('playerId', newId);
        return newId;
    });
    const [pastResults, setPastResults] = useState<GameResult[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [saveStatus, setSaveStatus] = useState<string>('');

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

    const loadPastResults = async () => {
        setIsLoading(true);
        try {
            const results = await getPlayerResults(playerId);
            setPastResults(results);
        } catch (error) {
            console.error('過去の結果の読み込みエラー:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveResult = async () => {
        if (!isCompleted) return;

        setSaveStatus('保存中...');
        try {
            const result: GameResult = {
                playerId,
                playerName,
                text,
                textLength: text.length,
                time: elapsedTime,
                wpm: calculateWPM(),
                accuracy: calculateAccuracy()
            };

            await saveGameResult(result);
            setSaveStatus('保存しました！');

            loadPastResults();
        } catch (error) {
            console.error('結果の保存エラー:', error);
            setSaveStatus('保存に失敗しました');
        }
    };

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

    useEffect(() => {
        loadPastResults();
    }, []);

    return (
        <div>
            <h2>タイピングゲーム</h2>

            <div>
                <label>
                    プレイヤー名:
                    <input
                        type="text"
                        value={playerName}
                        onChange={(e) => setPlayerName(e.target.value)}
                        placeholder="プレイヤー名"
                    />
                </label>
            </div>

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
                    <button onClick={handleSaveResult}>結果を保存</button>
                    {saveStatus && <p>{saveStatus}</p>}
                </div>
            )}

            <div>
                <button onClick={resetGame}>リセット</button>
                <button onClick={generateRandomText}>ランダムテキスト</button>
                <button onClick={loadPastResults} disabled={isLoading}>
                    {isLoading ? '読み込み中...' : '過去の結果を表示'}
                </button>

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

            {pastResults.length > 0 && (
                <div>
                    <h3>過去の結果</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>日時</th>
                                <th>WPM</th>
                                <th>正確度</th>
                                <th>時間</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pastResults.map((result, index) => (
                                <tr key={index}>
                                    <td>{result.createdAt ? new Date(result.createdAt).toLocaleString() : '不明'}</td>
                                    <td>{result.wpm}</td>
                                    <td>{result.accuracy}%</td>
                                    <td>{(result.time / 1000).toFixed(2)}秒</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default TypingGame;
