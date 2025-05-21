import { useState, useCallback, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase/config';
import { QUESTION_SETS } from '../constants/questionSets';

interface UseTypingGameProps {
    roomId: string;
    userId: string;
    isReady: boolean;
    dataChannel: React.RefObject<RTCDataChannel | null>;
    otherPlayerId: string | null;
    room: any;
}

interface UseTypingGameReturn {
    typingText: string;
    inputText: string;
    progress: number;
    totalProgress: number;
    score: number;
    currentSetIndex: number;
    currentQuestionIndex: number;
    gameStatus: 'waiting' | 'ready' | 'playing' | 'finished';
    isNotFoundEnding: boolean;
    handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
    toggleReady: () => Promise<void>;
    getCurrentQuestionNumber: () => number;
    getTotalQuestionCount: () => number;
}

export const useTypingGame = ({
    roomId,
    userId,
    isReady,
    dataChannel,
    otherPlayerId,
    room
}: UseTypingGameProps): UseTypingGameReturn => {
    const [typingText, setTypingText] = useState('');
    const [inputText, setInputText] = useState('');
    const [progress, setProgress] = useState(0);
    const [totalProgress, setTotalProgress] = useState(0);
    const [score, setScore] = useState(0);
    const [startTime, setStartTime] = useState<number | null>(null);
    const [gameStatus, setGameStatus] = useState<'waiting' | 'ready' | 'playing' | 'finished'>('waiting');
    const [isNotFoundEnding, setIsNotFoundEnding] = useState(false);
    const [currentSetIndex, setCurrentSetIndex] = useState(0);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

    // 問題セットの管理
    useEffect(() => {
        // 初期状態
        if (!typingText && QUESTION_SETS[0][0]) {
            console.log("Setting initial question");
            setTypingText(QUESTION_SETS[0][0]);
            setCurrentSetIndex(0);
            setCurrentQuestionIndex(0);
        }
    }, [typingText]);

    // 問題の総数を計算する関数
    const getTotalQuestionCount = useCallback(() => {
        return QUESTION_SETS.reduce((total, set) => total + set.length, 0);
    }, []);

    // 現在の問題が全体の何番目かを計算する関数
    const getCurrentQuestionNumber = useCallback(() => {
        let questionNumber = 0;
        for (let i = 0; i < currentSetIndex; i++) {
            questionNumber += QUESTION_SETS[i].length;
        }
        return questionNumber + currentQuestionIndex + 1;
    }, [currentSetIndex, currentQuestionIndex]);

    // 全体の進捗率を計算する関数
    const calculateTotalProgress = useCallback(() => {
        const currentNumber = getCurrentQuestionNumber();
        const totalNumber = getTotalQuestionCount();
        return Math.floor((currentNumber / totalNumber) * 100);
    }, [getCurrentQuestionNumber, getTotalQuestionCount]);

    // プレイヤーの進捗状態を更新
    const updatePlayerState = useCallback(async (
        progress: number,
        score: number,
        setIndex: number,
        questionIndex: number
    ): Promise<void> => {
        try {
            const currentTotalProgress = calculateTotalProgress();
            setTotalProgress(currentTotalProgress);
            const roomRef = doc(db, 'rooms', roomId);
            await updateDoc(roomRef, {
                [`gameState.players.${userId}.progress`]: progress,
                [`gameState.players.${userId}.score`]: score,
                [`gameState.players.${userId}.totalProgress`]: currentTotalProgress,
                [`gameState.players.${userId}.currentSetIndex`]: setIndex,
                [`gameState.players.${userId}.currentQuestionIndex`]: questionIndex
            });

        } catch (error) {
            console.error("Error updating player state:", error);
            throw error;
        }
    }, [roomId, userId, calculateTotalProgress]);

    // 準備状態を切り替える
    const toggleReady = useCallback(async (): Promise<void> => {
        const newReadyState = !isReady;

        try {
            const roomRef = doc(db, 'rooms', roomId);
            await updateDoc(roomRef, {
                [`gameState.players.${userId}.ready`]: newReadyState,
                [`gameState.players.${userId}.progress`]: 0
            });

            console.log("Player ready state updated in Firestore:", newReadyState);
            setIsNotFoundEnding(false);

            if (newReadyState) {
                const initialSet = 0;
                const initialQuestion = 0;
                const initialText = QUESTION_SETS[initialSet][initialQuestion];

                console.log("Setting up initial question in local state:", initialText);

                setCurrentSetIndex(initialSet);
                setCurrentQuestionIndex(initialQuestion);
                setInputText('');
                setProgress(0);
                setScore(0);
                setTotalProgress(0);
                setTypingText(initialText);
            }

        } catch (error) {
            console.error("Error updating ready state:", error);
            throw error;
        }
    }, [isReady, roomId, userId]);

    const handleInputChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
        if (gameStatus !== 'playing') return;

        const inputValue = e.target.value;
        setInputText(inputValue);

        // 進捗を計算（文字ごとの一致率）
        let matchCount = 0;
        const minLength = Math.min(inputValue.length, typingText.length);

        for (let i = 0; i < minLength; i++) {
            if (inputValue[i] === typingText[i]) {
                matchCount++;
            }
        }

        const lengthPenalty = Math.abs(inputValue.length - typingText.length) * 5;

        // 達成度を計算（最大100%）
        const newProgress = Math.max(0, Math.min(100, Math.round((matchCount / typingText.length) * 100 - lengthPenalty)));
        setProgress(newProgress);

        // 経過時間からスコアを計算
        if (startTime) {
            const elapsedTime = (Date.now() - startTime) / 1000;
            const newScore = Math.floor((matchCount / elapsedTime) * 60);
            setScore(newScore);
        }

        try {
            await updatePlayerState(newProgress, score, currentSetIndex, currentQuestionIndex);
        } catch (err) {
            console.error("Error updating progress in Firebase:", err);
        }

        if (inputValue === typingText) {
            console.log("Question completed:", typingText);

            // git push -f origin mainの場合はNot Found
            if (typingText === 'git push -f origin main') {
                console.log("Showing Not Found for force push");
                setIsNotFoundEnding(true);
                setGameStatus('finished');
                try {
                    await updatePlayerState(100, score, currentSetIndex, currentQuestionIndex);
                } catch (err) {
                    console.error("Error updating final progress:", err);
                }

                if (dataChannel.current?.readyState === 'open') {
                    dataChannel.current.send(JSON.stringify({
                        type: 'notFound',
                        timestamp: Date.now()
                    }));
                }
            } else {
                console.log("Question completed, moving to next question");

                let nextSetIndex = currentSetIndex;
                let nextQuestionIndex = currentQuestionIndex + 1;
                let nextQuestion = '';

                if (nextQuestionIndex < QUESTION_SETS[currentSetIndex].length) {
                    nextQuestion = QUESTION_SETS[currentSetIndex][nextQuestionIndex];
                } else {
                    nextSetIndex = (currentSetIndex + 1) % QUESTION_SETS.length;
                    nextQuestionIndex = 0;
                    nextQuestion = QUESTION_SETS[nextSetIndex][0];
                }

                console.log("Next question will be:", nextQuestion);

                try {
                    // ゲーム状態をすべて一度に更新
                    const roomRef = doc(db, 'rooms', roomId);
                    await updateDoc(roomRef, {
                        'gameState.typingText': nextQuestion,
                        'gameState.status': 'playing',
                        [`gameState.players.${userId}.progress`]: 0,
                        [`gameState.players.${userId}.currentSetIndex`]: nextSetIndex,
                        [`gameState.players.${userId}.currentQuestionIndex`]: nextQuestionIndex
                    });

                    setCurrentSetIndex(nextSetIndex);
                    setCurrentQuestionIndex(nextQuestionIndex);
                    setTypingText(nextQuestion);
                    setInputText('');
                    setProgress(0);

                    // 全体の進捗率を更新
                    const newTotalProgress = calculateTotalProgress();
                    setTotalProgress(newTotalProgress);

                    console.log("Successfully moved to next question");

                    // 問題完了時に進捗情報をWebRTC経由で相手に送信
                    if (dataChannel.current?.readyState === 'open') {
                        dataChannel.current.send(JSON.stringify({
                            type: 'progress',
                            progress: 0,
                            score: score,
                            totalProgress: newTotalProgress,
                            completed: true,
                            timestamp: Date.now()
                        }));
                    }
                } catch (err) {
                    console.error("Failed to update to next question:", err);
                }
            }
        }
    }, [
        gameStatus,
        typingText,
        startTime,
        score,
        currentSetIndex,
        currentQuestionIndex,
        updatePlayerState,
        calculateTotalProgress,
        roomId,
        userId
    ]);

    useEffect(() => {
        if (gameStatus === 'waiting' && isReady) {
            if (otherPlayerId && room?.gameState?.players) {
                const otherPlayerReady = room.gameState.players[otherPlayerId]?.ready || false;

                if (otherPlayerReady) {
                    console.log("Both players are ready, starting the game");
                    setGameStatus('playing');

                    const roomRef = doc(db, 'rooms', roomId);
                    updateDoc(roomRef, {
                        'gameState.status': 'playing'
                    }).catch(err => {
                        console.error("Error updating game status:", err);
                    });

                    if (!startTime) {
                        setStartTime(Date.now());
                    }
                } else {
                    console.log("Waiting for other player to be ready");
                }
            } else {
                console.log("Waiting for other player to join");
            }
        }
    }, [gameStatus, isReady, otherPlayerId, room, roomId, startTime]);

    return {
        typingText,
        inputText,
        progress,
        totalProgress,
        score,
        currentSetIndex,
        currentQuestionIndex,
        gameStatus,
        isNotFoundEnding,
        handleInputChange,
        toggleReady,
        getCurrentQuestionNumber,
        getTotalQuestionCount
    };
};
