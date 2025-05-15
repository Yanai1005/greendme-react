import { db } from './firebase/config';
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

export type Room = {
    id: string;
    name: string;
    createdAt: any;
    participants: string[];
    maxParticipants: number;
    gameType?: string;
    gameState?: any;
}

export type Message = {
    id: string;
    roomId: string;
    senderId: string;
    content: string;
    timestamp: any;
}

// WebRTC接続情報の型定義
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
            maxParticipants: 2, // 最大2人まで
            gameType,
            gameState: {
                status: 'waiting', // waiting, ready, playing, finished
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
        console.log('Room created:', roomId, roomData); // デバッグ用
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

        // 既に参加している場合
        if (roomData.participants.includes(userId)) {
            console.log(`User ${userId} is already in room ${roomId}`);
            return true;
        }

        // 部屋が満員の場合
        if (roomData.participants.length >= roomData.maxParticipants) {
            console.error(`Room ${roomId} is full (${roomData.participants.length}/${roomData.maxParticipants})`);
            throw new Error('Room is full');
        }

        // 参加者を追加
        const gameState = roomData.gameState || {
            status: 'waiting',
            players: {}
        };

        // 新しいプレイヤーの情報を追加
        gameState.players[userId] = {
            ready: false,
            score: 0,
            progress: 0
        };

        const updatedParticipants = [...roomData.participants, userId];
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

// ランダムマッチング（利用可能な部屋に参加、なければ新しい部屋を作成）
export const randomMatch = async (userId: string, userName: string): Promise<string> => {
    try {
        // 利用可能な部屋を探す
        const availableRooms = await getAvailableRooms();

        // 利用可能な部屋があればそこに参加
        if (availableRooms.length > 0) {
            // ランダムに一つ選ぶ
            const randomIndex = Math.floor(Math.random() * availableRooms.length);
            const selectedRoom = availableRooms[randomIndex];

            await joinRoom(selectedRoom.id, userId);
            return selectedRoom.id;
        }

        // 利用可能な部屋がなければ新しい部屋を作成
        const roomName = `${userName}の部屋`;
        return await createRoom(roomName, userId, 'typing');
    } catch (error) {
        console.error('Error in random matching:', error);
        throw error;
    }
};

// 部屋から退出する
export const leaveRoom = async (roomId: string, userId: string): Promise<boolean> => {
    try {
        const roomRef = doc(db, ROOMS_COLLECTION, roomId);
        const roomSnap = await getDoc(roomRef);

        if (!roomSnap.exists()) {
            throw new Error('Room not found');
        }

        const roomData = roomSnap.data() as Room;

        // ゲーム状態を更新
        const gameState = roomData.gameState || {};
        if (gameState.players && gameState.players[userId]) {
            delete gameState.players[userId];
        }

        // 参加者を削除
        await updateDoc(roomRef, {
            participants: roomData.participants.filter(id => id !== userId),
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
        // すべての部屋を取得
        const querySnapshot = await getDocs(roomsRef);

        const rooms: Room[] = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            // idフィールドがないドキュメントを修正
            const roomData: Room = {
                id: doc.id, // ドキュメントIDを使用
                name: data.name || 'No Name',
                createdAt: data.createdAt,
                participants: Array.isArray(data.participants) ? data.participants : [],
                maxParticipants: data.maxParticipants || 2,
                gameType: data.gameType,
                gameState: data.gameState
            };

            // 参加者が最大人数未満の部屋のみを表示
            if (roomData.participants.length < roomData.maxParticipants) {
                rooms.push(roomData);
            }
        });

        console.log('Available rooms:', rooms); // デバッグ用

        return rooms;
    } catch (error) {
        console.error('Error getting available rooms:', error);
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

// プレイヤーの準備状態を更新
export const updatePlayerReady = async (roomId: string, userId: string, isReady: boolean): Promise<boolean> => {
    try {
        const roomRef = doc(db, ROOMS_COLLECTION, roomId);
        const roomSnap = await getDoc(roomRef);

        if (!roomSnap.exists()) {
            throw new Error('Room not found');
        }

        const roomData = roomSnap.data() as Room;
        const gameState = roomData.gameState || {};

        if (!gameState.players) {
            gameState.players = {};
        }

        if (!gameState.players[userId]) {
            gameState.players[userId] = {
                ready: isReady,
                score: 0,
                progress: 0
            };
        } else {
            gameState.players[userId].ready = isReady;
        }

        // 全員が準備完了かチェック
        let allReady = true;
        for (const participantId of roomData.participants) {
            if (!gameState.players[participantId] || !gameState.players[participantId].ready) {
                allReady = false;
                break;
            }
        }

        // 全員が準備完了ならゲーム開始
        if (allReady && roomData.participants.length > 1) {
            // タイピングテキストが設定されているか確認
            if (!gameState.typingText) {
                console.error('Typing text is not set');
                // デフォルトのテキストを設定
                gameState.typingText = "こんにちは、タイピングゲームへようこそ。";
            }

            console.log('All players ready, starting game with text:', gameState.typingText);
            gameState.status = 'playing';
            gameState.startTime = serverTimestamp();

            // 各プレイヤーの進捗をリセット
            for (const participantId of roomData.participants) {
                if (gameState.players[participantId]) {
                    gameState.players[participantId].progress = 0;
                    gameState.players[participantId].score = 0;
                }
            }
        } else {
            gameState.status = 'waiting';
        }

        // ゲーム状態を更新
        await updateDoc(roomRef, { gameState });
        console.log('Game state updated:', gameState);
        return true;
    } catch (error) {
        console.error('Error updating player ready status:', error);
        throw error;
    }
};

// プレイヤーのゲーム進捗を更新
export const updatePlayerProgress = async (roomId: string, userId: string, progress: number, score: number): Promise<boolean> => {
    try {
        const roomRef = doc(db, ROOMS_COLLECTION, roomId);
        const roomSnap = await getDoc(roomRef);

        if (!roomSnap.exists()) {
            throw new Error('Room not found');
        }

        const roomData = roomSnap.data() as Room;
        const gameState = roomData.gameState || {};

        if (!gameState.players) {
            gameState.players = {};
        }

        if (!gameState.players[userId]) {
            gameState.players[userId] = {
                ready: true,
                score,
                progress
            };
        } else {
            gameState.players[userId].score = score;
            gameState.players[userId].progress = progress;
        }

        // 誰かが100%に到達したらゲーム終了
        if (progress >= 100) {
            gameState.status = 'finished';
            gameState.winner = userId;
            gameState.endTime = serverTimestamp();
        }

        await updateDoc(roomRef, { gameState });
        return true;
    } catch (error) {
        console.error('Error updating player progress:', error);
        throw error;
    }
};

// WebRTC接続情報の保存
export const saveRTCData = async (roomId: string, userId: string, connectionData: RTCConnectionData): Promise<boolean> => {
    try {
        // RTCSessionDescription オブジェクトを処理
        const processedData = {
            ...connectionData
        };

        // offer が RTCSessionDescription オブジェクトの場合、シリアライズ可能な形式に変換
        if (processedData.offer && typeof processedData.offer === 'object') {
            processedData.offer = {
                type: processedData.offer.type,
                sdp: processedData.offer.sdp
            };
        }

        // answer が RTCSessionDescription オブジェクトの場合、シリアライズ可能な形式に変換
        if (processedData.answer && typeof processedData.answer === 'object') {
            processedData.answer = {
                type: processedData.answer.type,
                sdp: processedData.answer.sdp
            };
        }

        // candidates を処理（必要な場合）
        if (processedData.candidates) {
            processedData.candidates = processedData.candidates.map(candidate => {
                if (candidate && typeof candidate === 'object') {
                    // RTCIceCandidate オブジェクトをシリアライズ可能な形式に変換
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

// 部屋のメッセージをリアルタイムで監視する
export const subscribeToMessages = (roomId: string, callback: (messages: Message[]) => void) => {
    const messagesRef = collection(db, ROOMS_COLLECTION, roomId, MESSAGES_COLLECTION);

    return onSnapshot(messagesRef, (snapshot) => {
        const messages: Message[] = [];
        snapshot.forEach((doc) => {
            messages.push(doc.data() as Message);
        });

        // タイムスタンプでソート
        messages.sort((a, b) => {
            if (!a.timestamp || !b.timestamp) return 0;
            return a.timestamp.seconds - b.timestamp.seconds;
        });

        callback(messages);
    });
};

// 部屋の情報をリアルタイムで監視する
export const subscribeToRoom = (roomId: string, callback: (room: Room | null) => void) => {
    const roomRef = doc(db, ROOMS_COLLECTION, roomId);

    return onSnapshot(roomRef, (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.data();
            // データの整合性を確保
            const roomData: Room = {
                id: snapshot.id,
                name: data.name || 'No Name',
                createdAt: data.createdAt,
                participants: Array.isArray(data.participants) ? data.participants : [],
                maxParticipants: data.maxParticipants || 2,
                gameType: data.gameType,
                gameState: data.gameState
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
