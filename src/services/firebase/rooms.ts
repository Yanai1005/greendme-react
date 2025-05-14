import { db } from './config';
import {
    collection,
    doc,
    addDoc,
    getDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    serverTimestamp,
    onSnapshot,
    limit,
    type DocumentData,
    QueryDocumentSnapshot
} from 'firebase/firestore';
import type { Room } from '../../types/firebase';

// ルームを作成する
export const createRoom = async (roomData: Omit<Room, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
    try {
        const roomsRef = collection(db, 'rooms');
        const docRef = await addDoc(roomsRef, {
            ...roomData,
            playerCount: 1,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        console.log("ルームを作成しました：", docRef.id);
        return docRef.id;
    } catch (error) {
        console.error('ルーム作成エラー:', error);
        throw error;
    }
};

// ルームの詳細を取得する
export const getRoom = async (roomId: string): Promise<Room | null> => {
    try {
        const roomRef = doc(db, 'rooms', roomId);
        const roomSnap = await getDoc(roomRef);

        if (roomSnap.exists()) {
            const roomData = roomSnap.data() as Room;
            return {
                ...roomData,
                id: roomSnap.id
            };
        }

        return null;
    } catch (error) {
        console.error('ルーム取得エラー:', error);
        throw error;
    }
};

// 利用可能なルーム一覧を取得する
export const getAvailableRooms = async (limitCount: number = 10): Promise<Room[]> => {
    try {
        const roomsRef = collection(db, 'rooms');
        const q = query(
            roomsRef,
            where('status', 'in', ['waiting', 'ready']),
            orderBy('createdAt', 'desc'),
            limit(limitCount)
        );

        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => {
            const data = doc.data() as Room;
            return {
                ...data,
                id: doc.id
            };
        });
    } catch (error) {
        console.error('ルーム一覧取得エラー:', error);
        throw error;
    }
};

// ルームの状態を更新する
export const updateRoomStatus = async (roomId: string, status: Room['status']): Promise<void> => {
    try {
        const roomRef = doc(db, 'rooms', roomId);
        await updateDoc(roomRef, {
            status,
            updatedAt: serverTimestamp()
        });
    } catch (error) {
        console.error('ルーム状態更新エラー:', error);
        throw error;
    }
};

// プレーヤーカウントを更新する
export const updatePlayerCount = async (roomId: string, count: number): Promise<void> => {
    try {
        const roomRef = doc(db, 'rooms', roomId);
        await updateDoc(roomRef, {
            playerCount: count,
            updatedAt: serverTimestamp()
        });
    } catch (error) {
        console.error('プレイヤーカウント更新エラー:', error);
        throw error;
    }
};

// ルームを削除する
export const deleteRoom = async (roomId: string): Promise<void> => {
    try {
        const roomRef = doc(db, 'rooms', roomId);
        await deleteDoc(roomRef);
    } catch (error) {
        console.error('ルーム削除エラー:', error);
        throw error;
    }
};

// ルームの変更を監視する
export const subscribeToRoom = (roomId: string, callback: (room: Room | null) => void): () => void => {
    const roomRef = doc(db, 'rooms', roomId);

    return onSnapshot(roomRef, (snapshot) => {
        if (snapshot.exists()) {
            const roomData = snapshot.data() as Room;
            callback({
                ...roomData,
                id: snapshot.id
            });
        } else {
            callback(null);
        }
    });
};

// 利用可能なルーム一覧の変更を監視する
export const subscribeToAvailableRooms = (callback: (rooms: Room[]) => void): () => void => {
    const roomsRef = collection(db, 'rooms');
    const q = query(
        roomsRef,
        where('status', 'in', ['waiting', 'ready']),
        orderBy('createdAt', 'desc'),
        limit(10)
    );

    return onSnapshot(q, (snapshot) => {
        const rooms = snapshot.docs.map((doc) => {
            const data = doc.data() as Room;
            return {
                ...data,
                id: doc.id
            };
        });

        callback(rooms);
    });
};
