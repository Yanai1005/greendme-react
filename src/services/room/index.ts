import { db } from '../firebase/config';
import {
    collection,
    doc,
    setDoc,
    getDoc,
    updateDoc,
    onSnapshot,
    serverTimestamp,
    getDocs
} from 'firebase/firestore';
import type {
    Room,
    Message,
    RTCConnectionData,
    GameState,
} from './types';

// コレクション名の定数
const ROOMS_COLLECTION = 'rooms';
const MESSAGES_COLLECTION = 'messages';
const RTC_COLLECTION = 'rtc';

// 新しい部屋を作成する
export const createRoom = async (name: string, creatorId: string, gameType: string = 'typing'): Promise<string> => {
    try {
        const roomsRef = collection(db, ROOMS_COLLECTION);
        const newRoomRef = doc(roomsRef);
        const roomId = newRoomRef.id;

        const roomData: Room = {
            id: roomId,
            name,
            createdAt: serverTimestamp(),
            participants: [creatorId],
            maxParticipants: 2,
            gameType,
            gameState: {
                status: 'waiting',
                players: {
                    [creatorId]: {
                        ready: false,
                        score: 0,
                        progress: 0
                    }
                }
            }
        };

        await setDoc(newRoomRef, roomData);
        console.log('Room created:', roomId, roomData);
        return roomId;
    } catch (error) {
        console.error('Error creating room:', error);
        throw error;
    }
};

// 部屋に参加する
export const joinRoom = async (roomId: string, userId: string): Promise<boolean> => {
    try {
        console.log(`Attempting to join room ${roomId} with user ${userId}`);
        const roomRef = doc(db, ROOMS_COLLECTION, roomId);
        const roomSnap = await getDoc(roomRef);

        if (!roomSnap.exists()) {
            console.error(`Room ${roomId} not found`);
            throw new Error('Room not found');
        }

        const roomData = roomSnap.data() as Room;
        console.log(`Room data:`, roomData);

        const participants = Array.isArray(roomData.participants) ? roomData.participants : [];

        if (participants.includes(userId)) {
            console.log(`User ${userId} is already in room ${roomId}`);
            return true;
        }

        if (participants.length >= (roomData.maxParticipants || 2)) {
            console.error(`Room ${roomId} is full (${participants.length}/${roomData.maxParticipants || 2})`);
            throw new Error('Room is full');
        }

        // 明示的に GameState 型を指定し、players が必ず存在するようにする
        const gameState: GameState = roomData.gameState || {
            status: 'waiting',
            players: {}
        };

        // players が undefined でないことを保証
        if (!gameState.players) {
            gameState.players = {};
        }

        gameState.players[userId] = {
            ready: false,
            score: 0,
            progress: 0
        };

        const updatedParticipants = [...participants, userId];
        console.log(`Updating participants for room ${roomId}:`, updatedParticipants);

        await updateDoc(roomRef, {
            participants: updatedParticipants,
            gameState
        });

        console.log(`Successfully joined room ${roomId}`);
        return true;
    } catch (error) {
        console.error(`Error joining room ${roomId}:`, error);
        throw error;
    }
};

// ランダムマッチング
export const randomMatch = async (userId: string, userName: string): Promise<string> => {
    try {
        const availableRooms = await getAvailableRooms();

        if (availableRooms.length > 0) {
            const randomIndex = Math.floor(Math.random() * availableRooms.length);
            const selectedRoom = availableRooms[randomIndex];

            await joinRoom(selectedRoom.id, userId);
            return selectedRoom.id;
        }

        const roomName = `${userName}の部屋`;
        return await createRoom(roomName, userId, 'typing');
    } catch (error) {
        console.error('Error in random matching:', error);
        throw error;
    }
};

// 部屋を退出する
export const leaveRoom = async (roomId: string, userId: string): Promise<boolean> => {
    try {
        const roomRef = doc(db, ROOMS_COLLECTION, roomId);
        const roomSnap = await getDoc(roomRef);

        if (!roomSnap.exists()) {
            throw new Error('Room not found');
        }

        const roomData = roomSnap.data() as Room;
        const participants = Array.isArray(roomData.participants) ? roomData.participants : [];

        // 型を明示的に指定
        const gameState: GameState = roomData.gameState || {
            status: 'waiting',
            players: {}
        };

        // players が存在することを確認
        if (gameState.players && gameState.players[userId]) {
            delete gameState.players[userId];
        }

        await updateDoc(roomRef, {
            participants: participants.filter(id => id !== userId),
            gameState
        });

        return true;
    } catch (error) {
        console.error('Error leaving room:', error);
        throw error;
    }
};

// 部屋の情報を取得する
export const getRoom = async (roomId: string): Promise<Room> => {
    try {
        const roomRef = doc(db, ROOMS_COLLECTION, roomId);
        const roomSnap = await getDoc(roomRef);

        if (!roomSnap.exists()) {
            throw new Error('Room not found');
        }

        return roomSnap.data() as Room;
    } catch (error) {
        console.error('Error getting room:', error);
        throw error;
    }
};

// 利用可能な部屋のリストを取得する
export const getAvailableRooms = async (): Promise<Room[]> => {
    try {
        const roomsRef = collection(db, ROOMS_COLLECTION);
        const querySnapshot = await getDocs(roomsRef);
        const rooms: Room[] = [];

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const participants = Array.isArray(data.participants) ? data.participants : [];

            // gameState が存在することを確認
            const gameState: GameState = data.gameState || {
                status: 'waiting',
                players: {}
            };

            const roomData: Room = {
                id: doc.id,
                name: data.name || 'No Name',
                createdAt: data.createdAt,
                participants: participants,
                maxParticipants: data.maxParticipants || 2,
                gameType: data.gameType,
                gameState
            };

            if (participants.length < roomData.maxParticipants) {
                rooms.push(roomData);
            }
        });

        console.log('Available rooms:', rooms);
        return rooms;
    } catch (error) {
        console.error('Error getting available rooms:', error);
        throw error;
    }
};

// WebRTC接続情報の保存
export const saveRTCData = async (roomId: string, userId: string, connectionData: RTCConnectionData): Promise<boolean> => {
    try {
        const processedData = {
            ...connectionData
        };

        if (processedData.offer && typeof processedData.offer === 'object') {
            processedData.offer = {
                type: processedData.offer.type,
                sdp: processedData.offer.sdp
            };
        }

        if (processedData.answer && typeof processedData.answer === 'object') {
            processedData.answer = {
                type: processedData.answer.type,
                sdp: processedData.answer.sdp
            };
        }

        if (processedData.candidates) {
            processedData.candidates = processedData.candidates.map(candidate => {
                if (candidate && typeof candidate === 'object') {
                    return {
                        candidate: candidate.candidate,
                        sdpMid: candidate.sdpMid,
                        sdpMLineIndex: candidate.sdpMLineIndex,
                        usernameFragment: candidate.usernameFragment
                    };
                }
                return candidate;
            });
        }

        console.log('Saving processed RTC data:', processedData);

        const rtcRef = doc(db, ROOMS_COLLECTION, roomId, RTC_COLLECTION, userId);
        await setDoc(rtcRef, processedData);
        return true;
    } catch (error) {
        console.error('Error saving RTC data:', error);
        throw error;
    }
};

// WebRTC接続情報の取得
export const getRTCData = async (roomId: string, userId: string): Promise<RTCConnectionData | null> => {
    try {
        const rtcRef = doc(db, ROOMS_COLLECTION, roomId, RTC_COLLECTION, userId);
        const rtcSnap = await getDoc(rtcRef);

        if (!rtcSnap.exists()) {
            return null;
        }

        return rtcSnap.data() as RTCConnectionData;
    } catch (error) {
        console.error('Error getting RTC data:', error);
        throw error;
    }
};

// 部屋の情報をリアルタイムで監視する
export const subscribeToRoom = (roomId: string, callback: (room: Room | null) => void) => {
    const roomRef = doc(db, ROOMS_COLLECTION, roomId);

    return onSnapshot(roomRef, (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.data();

            // gameState が必ず存在し、players が含まれるように保証
            const gameState: GameState = data.gameState || {
                status: 'waiting',
                players: {}
            };

            // players が未定義の場合に備える
            if (!gameState.players) {
                gameState.players = {};
            }

            const roomData: Room = {
                id: snapshot.id,
                name: data.name || 'No Name',
                createdAt: data.createdAt,
                participants: Array.isArray(data.participants) ? data.participants : [],
                maxParticipants: data.maxParticipants || 2,
                gameType: data.gameType,
                gameState
            };
            callback(roomData);
        } else {
            callback(null);
        }
    });
};

// WebRTC接続情報をリアルタイムで監視する
export const subscribeToRTCData = (roomId: string, userId: string, callback: (data: RTCConnectionData | null) => void) => {
    const rtcRef = doc(db, ROOMS_COLLECTION, roomId, RTC_COLLECTION, userId);

    return onSnapshot(rtcRef, (snapshot) => {
        if (snapshot.exists()) {
            callback(snapshot.data() as RTCConnectionData);
        } else {
            callback(null);
        }
    });
};

// プレイヤーの準備状態を更新
export const updatePlayerReady = async (roomId: string, userId: string, isReady: boolean): Promise<boolean> => {
    try {
        const roomRef = doc(db, ROOMS_COLLECTION, roomId);
        await updateDoc(roomRef, {
            [`gameState.players.${userId}.ready`]: isReady
        });
        return true;
    } catch (error) {
        console.error('Error updating player ready status:', error);
        throw error;
    }
};

// プレイヤーの進捗を更新
export const updatePlayerProgress = async (
    roomId: string,
    userId: string,
    progress: number,
    score: number
): Promise<boolean> => {
    try {
        const roomRef = doc(db, ROOMS_COLLECTION, roomId);
        await updateDoc(roomRef, {
            [`gameState.players.${userId}.progress`]: progress,
            [`gameState.players.${userId}.score`]: score
        });
        return true;
    } catch (error) {
        console.error('Error updating player progress:', error);
        throw error;
    }
};

// メッセージを送信する
export const sendMessage = async (roomId: string, senderId: string, content: string): Promise<string> => {
    try {
        const messagesRef = collection(db, ROOMS_COLLECTION, roomId, MESSAGES_COLLECTION);
        const newMessageRef = doc(messagesRef);
        const messageId = newMessageRef.id;

        const messageData: Message = {
            id: messageId,
            roomId,
            senderId,
            content,
            timestamp: serverTimestamp()
        };

        await setDoc(newMessageRef, messageData);
        return messageId;
    } catch (error) {
        console.error('Error sending message:', error);
        throw error;
    }
};

// ゲームの状態を更新
export const updateGameState = async (roomId: string, gameState: Partial<GameState>): Promise<boolean> => {
    try {
        const roomRef = doc(db, ROOMS_COLLECTION, roomId);
        await updateDoc(roomRef, { gameState });
        return true;
    } catch (error) {
        console.error('Error updating game state:', error);
        throw error;
    }
};
