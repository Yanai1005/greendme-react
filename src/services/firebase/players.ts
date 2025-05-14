import { db } from './config';
import {
    collection,
    doc,
    addDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    serverTimestamp,
    onSnapshot,
    type DocumentData,
    QueryDocumentSnapshot
} from 'firebase/firestore';
import type { Player } from '../../types/firebase';

// プレイヤーをルームに追加する
export const addPlayerToRoom = async (playerData: Omit<Player, 'id' | 'joinedAt' | 'updatedAt'>): Promise<string> => {
    try {
        const playersRef = collection(db, 'players');
        const docRef = await addDoc(playersRef, {
            ...playerData,
            progress: 0,
            wpm: 0,
            accuracy: 0,
            isCompleted: false,
            joinedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        console.log("プレイヤーをルームに追加しました：", docRef.id);
        return docRef.id;
    } catch (error) {
        console.error('プレイヤー追加エラー:', error);
        throw error;
    }
};

// プレイヤーの状態を更新する
export const updatePlayerStatus = async (
    playerId: string,
    data: Partial<Pick<Player, 'progress' | 'wpm' | 'accuracy' | 'isCompleted' | 'completedAt'>>
): Promise<void> => {
    try {
        const playerRef = doc(db, 'players', playerId);

        await updateDoc(playerRef, {
            ...data,
            updatedAt: serverTimestamp()
        });
    } catch (error) {
        console.error('プレイヤー状態更新エラー:', error);
        throw error;
    }
};

// ルームのプレイヤー一覧を取得する
export const getPlayersInRoom = async (roomId: string): Promise<Player[]> => {
    try {
        const playersRef = collection(db, 'players');
        const q = query(
            playersRef,
            where('roomId', '==', roomId),
            orderBy('joinedAt', 'asc')
        );

        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => {
            const data = doc.data() as Player;
            return {
                ...data,
                id: doc.id
            };
        });
    } catch (error) {
        console.error('ルームプレイヤー取得エラー:', error);
        throw error;
    }
};

// プレイヤーをルームから削除する
export const removePlayerFromRoom = async (playerId: string): Promise<void> => {
    try {
        const playerRef = doc(db, 'players', playerId);
        await deleteDoc(playerRef);
    } catch (error) {
        console.error('プレイヤー削除エラー:', error);
        throw error;
    }
};

// ルームのプレイヤー一覧の変更を監視する
export const subscribeToPlayersInRoom = (roomId: string, callback: (players: Player[]) => void): () => void => {
    const playersRef = collection(db, 'players');
    const q = query(
        playersRef,
        where('roomId', '==', roomId),
        orderBy('joinedAt', 'asc')
    );

    return onSnapshot(q, (snapshot) => {
        const players = snapshot.docs.map((doc) => {
            const data = doc.data() as Player;
            return {
                ...data,
                id: doc.id
            };
        });

        callback(players);
    });
};
