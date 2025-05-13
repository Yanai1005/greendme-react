export interface User {
    uid: string;
    displayName?: string;
    email?: string;
    photoURL?: string;
    createdAt: Date | number;
}

export interface GameResult {
    id?: string;
    userId: string;
    userName: string;
    text: string;
    textLength: number;
    time: number;
    wpm: number;
    accuracy: number;
    difficulty: string;
    createdAt: Date | number;
}

export interface Room {
    id?: string;
    createdBy: string;
    creatorName: string;
    status: 'waiting' | 'ready' | 'active' | 'completed';
    text: string;
    difficulty: string;
    playerCount: number;
    createdAt: Date | number;
    updatedAt: Date | number;
}

export interface Player {
    id?: string;
    roomId: string;
    userId: string;
    userName: string;
    progress: number;
    wpm: number;
    accuracy: number;
    isCompleted: boolean;
    completedAt?: Date | number;
    joinedAt: Date | number;
    updatedAt: Date | number;
}
