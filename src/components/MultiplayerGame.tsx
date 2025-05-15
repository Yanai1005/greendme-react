import React, { useEffect, useState, useCallback, useRef } from 'react';
import { SimpleP2P } from '../services/SimpleP2P';

interface MultiplayerGameProps {
    p2p: SimpleP2P;
}

interface GameState {
    playerScore: number;
    opponentScore: number;
    isGameStarted: boolean;
    isGameEnded: boolean;
    currentWord: string;
    playerInput: string;
    timeLeft: number;
    countdownValue: number;
}

const GAME_DURATION = 60;
const COUNTDOWN_DURATION = 3;
const WORDS = [
    'typescript', 'javascript', 'react', 'programming',
    'developer', 'computer', 'keyboard', 'interface',
    'function', 'variable', 'component', 'database',
    'algorithm', 'framework', 'library', 'application',
    'frontend', 'backend', 'fullstack', 'deployment'
];

export const MultiplayerGame: React.FC<MultiplayerGameProps> = ({ p2p }) => {
    const [gameState, setGameState] = useState<GameState>({
        playerScore: 0,
        opponentScore: 0,
        isGameStarted: false,
        isGameEnded: false,
        currentWord: '',
        playerInput: '',
        timeLeft: GAME_DURATION,
        countdownValue: COUNTDOWN_DURATION,
    });
    const [isCountingDown, setIsCountingDown] = useState(false);
    const [isWaitingForOpponent, setIsWaitingForOpponent] = useState(false);
    const gameTimerRef = useRef<NodeJS.Timeout | null>(null);
    const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

    const getRandomWord = () => {
        return WORDS[Math.floor(Math.random() * WORDS.length)];
    };

    const startCountdown = useCallback(() => {
        setIsCountingDown(true);

        // カウントダウンタイマーの開始
        setGameState(prev => ({
            ...prev,
            countdownValue: COUNTDOWN_DURATION
        }));

        if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
        }

        countdownTimerRef.current = setInterval(() => {
            setGameState(prev => {
                const newCountdownValue = prev.countdownValue - 1;

                if (newCountdownValue <= 0) {
                    // カウントダウン終了時にゲーム開始
                    clearInterval(countdownTimerRef.current!);
                    startActualGame();
                    return {
                        ...prev,
                        countdownValue: 0,
                    };
                }

                return {
                    ...prev,
                    countdownValue: newCountdownValue
                };
            });
        }, 1000);
    }, []);

    const startActualGame = useCallback(() => {
        setIsCountingDown(false);
        setGameState(prev => ({
            ...prev,
            isGameStarted: true,
            currentWord: getRandomWord(),
            timeLeft: GAME_DURATION,
            playerScore: 0,
            opponentScore: 0,
        }));

        // ゲームタイマーの開始
        if (gameTimerRef.current) {
            clearInterval(gameTimerRef.current);
        }

        gameTimerRef.current = setInterval(() => {
            setGameState(prev => {
                if (prev.timeLeft <= 1) {
                    // ゲーム終了処理
                    clearInterval(gameTimerRef.current!);
                    p2p.sendMessage(JSON.stringify({
                        type: 'gameEnd',
                        score: prev.playerScore,
                    }));
                    return { ...prev, timeLeft: 0, isGameStarted: false, isGameEnded: true };
                }
                return { ...prev, timeLeft: prev.timeLeft - 1 };
            });
        }, 1000);
    }, [p2p]);

    // ゲーム開始要求と応答を処理
    useEffect(() => {
        const handleGameMessages = (message: string) => {
            try {
                const data = JSON.parse(message);
                console.log('Received game message:', data);

                if (data.type === 'requestGameStart') {
                    p2p.sendMessage(JSON.stringify({ type: 'acceptGameStart' }));
                    startCountdown();
                }
                else if (data.type === 'acceptGameStart') {
                    setIsWaitingForOpponent(false);
                    startCountdown();
                }
                else if (data.type === 'scoreUpdate') {
                    setGameState(prev => ({
                        ...prev,
                        opponentScore: data.score
                    }));
                }
                else if (data.type === 'gameEnd') {
                    // 相手がゲーム終了
                    setGameState(prev => ({
                        ...prev,
                        opponentScore: data.score,
                        isGameStarted: false,
                        isGameEnded: true
                    }));

                    if (gameTimerRef.current) {
                        clearInterval(gameTimerRef.current);
                    }
                }
            } catch (error) {
                console.error('Error parsing game message:', error);
            }
        };

        p2p.onMessage(handleGameMessages);

        return () => {
            if (gameTimerRef.current) {
                clearInterval(gameTimerRef.current);
            }
            if (countdownTimerRef.current) {
                clearInterval(countdownTimerRef.current);
            }
        };
    }, [p2p, startCountdown]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const input = e.target.value;
        setGameState(prev => ({ ...prev, playerInput: input }));

        if (input === gameState.currentWord) {
            // 単語が一致したらスコアを更新し、新しい単語を設定
            const newScore = gameState.playerScore + gameState.currentWord.length;

            setGameState(prev => ({
                ...prev,
                playerScore: newScore,
                currentWord: getRandomWord(),
                playerInput: '',
            }));

            // スコア更新を相手に送信
            p2p.sendMessage(JSON.stringify({
                type: 'scoreUpdate',
                score: newScore
            }));
        }
    };

    const handleStartGame = () => {
        setIsWaitingForOpponent(true);
        // ゲーム開始リクエストを送信
        p2p.sendMessage(JSON.stringify({ type: 'requestGameStart' }));
    };

    const handlePlayAgain = () => {
        setGameState(prev => ({
            ...prev,
            isGameEnded: false
        }));
    };

    if (isCountingDown) {
        return (
            <div className="p-4 text-center">
                <h2 className="text-3xl font-bold mb-6">ゲーム開始まで</h2>
                <p className="text-6xl font-bold text-red-500 animate-pulse">
                    {gameState.countdownValue}
                </p>
                <p className="mt-4 text-gray-600">準備してください！</p>
            </div>
        );
    }

    if (isWaitingForOpponent) {
        return (
            <div className="p-4 text-center">
                <h2 className="text-xl font-bold mb-4">相手の準備を待っています...</h2>
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            </div>
        );
    }

    return (
        <div className="p-4">
            <div className="flex justify-between mb-4">
                <div>
                    <h3>Your Score</h3>
                    <p className="text-2xl">{gameState.playerScore}</p>
                </div>
                <div>
                    <h3>Opponent's Score</h3>
                    <p className="text-2xl">{gameState.opponentScore}</p>
                </div>
                <div>
                    <h3>Time Left</h3>
                    <p className="text-2xl">{gameState.timeLeft}s</p>
                </div>
            </div>

            {!gameState.isGameStarted && !gameState.isGameEnded && (
                <div className="text-center">
                    <button
                        onClick={handleStartGame}
                        className="bg-blue-500 text-white px-6 py-3 rounded-lg text-lg font-semibold hover:bg-blue-600 transition-colors"
                    >
                        Start Game
                    </button>
                </div>
            )}

            {gameState.isGameEnded && (
                <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold mb-4">Game Over!</h2>
                    <p className="text-xl mb-6">
                        {gameState.playerScore > gameState.opponentScore
                            ? 'You won! 🎉'
                            : gameState.playerScore < gameState.opponentScore
                                ? 'You lost! 😢'
                                : 'It\'s a tie! 🤝'}
                    </p>
                    <div className="flex justify-center gap-4">
                        <button
                            onClick={handlePlayAgain}
                            className="bg-blue-500 text-white px-6 py-3 rounded-lg text-lg font-semibold hover:bg-blue-600 transition-colors"
                        >
                            Play Again
                        </button>
                    </div>
                </div>
            )}

            {gameState.isGameStarted && (
                <div className="space-y-4">
                    <div className="text-center">
                        <h2 className="text-2xl font-bold mb-2">Type this word:</h2>
                        <p className="text-3xl text-blue-600 font-mono">{gameState.currentWord}</p>
                    </div>
                    <input
                        type="text"
                        value={gameState.playerInput}
                        onChange={handleInputChange}
                        className="w-full p-3 text-xl font-mono border-2 border-gray-300 rounded focus:border-blue-500 focus:outline-none"
                        placeholder="Type here..."
                        autoFocus
                    />
                </div>
            )}
        </div>
    );
}; 
