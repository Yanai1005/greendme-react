import { useState, useEffect, useCallback } from 'react';

interface CharStats {
    correct: number;
    incorrect: number;
    total: number;
}

interface UseTypingGameReturn {
    text: string;
    input: string;
    startTime: number | null;
    endTime: number | null;
    progress: number;
    charStats: CharStats;
    elapsedTime: number;
    isCompleted: boolean;
    handleInput: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    resetGame: () => void;
    changeText: (newText: string) => void;
    calculateWPM: () => number;
    calculateAccuracy: () => number;
}

export const useTypingGame = (initialText: string): UseTypingGameReturn => {
    const [text, setText] = useState<string>(initialText || '');
    const [input, setInput] = useState<string>('');
    const [startTime, setStartTime] = useState<number | null>(null);
    const [endTime, setEndTime] = useState<number | null>(null);
    const [progress, setProgress] = useState<number>(0);
    const [charStats, setCharStats] = useState<CharStats>({ correct: 0, incorrect: 0, total: 0 });
    const [isRunning, setIsRunning] = useState<boolean>(false);
    const [elapsedTime, setElapsedTime] = useState<number>(0);

    // テキストを変更する
    const changeText = useCallback((newText: string) => {
        setText(newText);
        resetGame();
    }, []);

    // 入力処理
    const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newInput = e.target.value;

        // ゲームが終了していたら何もしない
        if (endTime) return;

        // 最初の入力で開始時間を設定
        if (!startTime && newInput.length > 0) {
            setStartTime(Date.now());
            setIsRunning(true);
        }

        setInput(newInput);

        // 進捗と正誤の計算
        const currentText = text.substring(0, newInput.length);
        let correctChars = 0;
        let incorrectChars = 0;

        for (let i = 0; i < newInput.length; i++) {
            if (i < text.length) {
                if (newInput[i] === text[i]) {
                    correctChars++;
                } else {
                    incorrectChars++;
                }
            }
        }

        const totalChars = newInput.length;
        const newProgress = (correctChars / text.length) * 100;

        setCharStats({
            correct: correctChars,
            incorrect: incorrectChars,
            total: totalChars
        });

        setProgress(newProgress);

        // ゲーム終了判定
        if (newInput === text) {
            setEndTime(Date.now());
            setIsRunning(false);
        }
    }, [text, startTime, endTime]);

    // リセット処理
    const resetGame = useCallback(() => {
        setInput('');
        setStartTime(null);
        setEndTime(null);
        setProgress(0);
        setCharStats({ correct: 0, incorrect: 0, total: 0 });
        setIsRunning(false);
        setElapsedTime(0);
    }, []);

    // WPM (Words Per Minute) 計算
    const calculateWPM = useCallback((): number => {
        if (!startTime) return 0;

        const currentTime = endTime || Date.now();

        // 日本語の場合は文字数÷5で単語数とみなすことが多い
        const wordCount = text.length / 5;
        const minutes = (currentTime - startTime) / 1000 / 60;

        if (minutes === 0) return 0;

        if (endTime) {
            // ゲーム終了時はフルテキストでの計算
            return Math.round(wordCount / minutes);
        } else {
            // ゲーム実行中は入力済み部分での計算
            return Math.round(wordCount * (input.length / text.length) / minutes);
        }
    }, [text, input, startTime, endTime]);

    // 正確度計算 (%)
    const calculateAccuracy = useCallback((): number => {
        if (charStats.total === 0) return 100;
        return Math.round((charStats.correct / charStats.total) * 100);
    }, [charStats]);

    // タイマー更新
    useEffect(() => {
        let timerId: number | undefined;

        if (isRunning) {
            timerId = window.setInterval(() => {
                setElapsedTime(Date.now() - (startTime || 0));
            }, 100);
        }

        return () => {
            if (timerId) clearInterval(timerId);
        };
    }, [isRunning, startTime]);

    return {
        text,
        input,
        startTime,
        endTime,
        progress,
        charStats,
        elapsedTime,
        isCompleted: endTime !== null,
        handleInput,
        resetGame,
        changeText,
        calculateWPM,
        calculateAccuracy
    };
};
