import { db } from './config';
import {
    collection,
    addDoc,
    getDocs,
    query,
    where,
    orderBy,
    limit,
    serverTimestamp,
    type DocumentData,
    QueryDocumentSnapshot
} from 'firebase/firestore';

export interface GameResult {
    playerId: string;
    playerName: string;
    text: string;
    textLength: number;
    time: number;
    wpm: number;
    accuracy: number;
    createdAt?: any;
}

export const saveGameResult = async (result: GameResult): Promise<string> => {
    try {
        const resultsRef = collection(db, 'gameResults');
        const docRef = await addDoc(resultsRef, {
            ...result,
            createdAt: serverTimestamp()
        });
        console.log("ゲーム結果を保存しました：", docRef.id);
        return docRef.id;
    } catch (error) {
        console.error('ゲーム結果の保存エラー:', error);
        throw error;
    }
};

export const getPlayerResults = async (playerId: string, limitCount: number = 10): Promise<GameResult[]> => {
    try {
        const resultsRef = collection(db, 'gameResults');
        const q = query(
            resultsRef,
            where('playerId', '==', playerId),
            orderBy('createdAt', 'desc'),
            limit(limitCount)
        );

        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => {
            const data = doc.data() as GameResult;
            if (data.createdAt?.toMillis) {
                data.createdAt = data.createdAt.toMillis();
            }
            return data;
        });
    } catch (error) {
        console.error('結果取得エラー:', error);
        throw error;
    }
};

export const getTopScores = async (limitCount: number = 10): Promise<GameResult[]> => {
    try {
        const resultsRef = collection(db, 'gameResults');
        const q = query(
            resultsRef,
            orderBy('wpm', 'desc'),
            limit(limitCount)
        );

        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => {
            const data = doc.data() as GameResult;
            if (data.createdAt?.toMillis) {
                data.createdAt = data.createdAt.toMillis();
            }
            return data;
        });
    } catch (error) {
        console.error('トップスコア取得エラー:', error);
        throw error;
    }
};
