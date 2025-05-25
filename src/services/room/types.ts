export type Room = {
    id: string;
    name: string;
    createdAt: any;
    participants: string[];
    maxParticipants: number;
    gameType?: string;
    gameState?: GameState;
}

export interface GameState {
    status: 'waiting' | 'ready' | 'playing' | 'finished';
    typingText?: string;
    startTime?: any;
    endTime?: any;
    winner?: string;
    players: {
        [key: string]: PlayerState;
    };
}

export interface PlayerState {
    ready: boolean;
    progress: number;
    score: number;
    totalProgress: number;
    currentSetIndex?: number;
    currentQuestionIndex?: number;
    completed?: boolean;
}

export type RTCConnectionData = {
    offer?: {
        type: string;
        sdp: string;
    };
    answer?: {
        type: string;
        sdp: string;
    };
    candidates: Array<{
        candidate: string;
        sdpMid: string | null;
        sdpMLineIndex: number | null;
        usernameFragment?: string | null;
    }>;
}

// メッセージの型定義
export type Message = {
    id: string;
    roomId: string;
    senderId: string;
    content: string;
    timestamp: any;
}
