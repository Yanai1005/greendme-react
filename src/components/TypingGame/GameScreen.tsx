import type { Room } from '../../services/room/types';
import { QUESTION_SETS } from '../../constants/questionSets';
import TypingProgress from './TypingProgress';

type GameScreenProps = {
    typingText: string;
    inputText: string;
    onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
    progress: number;
    totalProgress: number;
    otherPlayerId: string | null;
    room: Room;
    currentQuestionIndex: number;
    currentSetIndex: number;
};

const GameScreen = (props: GameScreenProps) => {
    const {
        typingText,
        inputText,
        onInputChange,
        progress,
        totalProgress,
        otherPlayerId,
        room,
        currentQuestionIndex,
        currentSetIndex
    } = props;

    return (
        <div className="game-screen">
            <div className="typing-area">
                <div className="typing-text">
                    {typingText || 'タイピングテキストが設定されていません'}
                </div>

                <input
                    type="text"
                    value={inputText}
                    onChange={onInputChange}
                    className="typing-input"
                    autoFocus
                    disabled={!typingText}
                    placeholder={typingText ? "ここに入力してください" : "ゲームの準備中です..."}
                />

                <div className="text-sm text-gray-500 mt-2">
                    問題 {currentQuestionIndex + 1}/{QUESTION_SETS[currentSetIndex].length}
                </div>
            </div>

            <div className="progress-area">
                <TypingProgress
                    label="あなた"
                    progress={progress}
                    totalProgress={totalProgress}
                    progressColor="bg-green-500"
                />

                {otherPlayerId && room?.gameState?.players && room.gameState.players[otherPlayerId] && (
                    <TypingProgress
                        label="対戦相手"
                        progress={room.gameState.players[otherPlayerId].progress}
                        totalProgress={room.gameState.players[otherPlayerId].totalProgress || 0}
                        progressColor="bg-red-500"
                    />
                )}
            </div>
        </div>
    );
};

export default GameScreen;
