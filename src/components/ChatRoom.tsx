import React, { useState, useEffect, useRef } from 'react';
import {
    getRoom,
    joinRoom,
    leaveRoom,
    sendMessage,
    subscribeToMessages,
    subscribeToRoom
} from '../services/roomService';
import type { Room, Message } from '../services/roomService';

interface ChatRoomProps {
    roomId: string;
    userId: string;
    userName: string;
    onLeaveRoom: () => void;
}

const ChatRoom: React.FC<ChatRoomProps> = ({ roomId, userId, onLeaveRoom }) => {
    const [room, setRoom] = useState<Room | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [isJoining, setIsJoining] = useState<boolean>(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // 部屋に参加
    useEffect(() => {
        const joinChatRoom = async () => {
            try {
                setIsJoining(true);
                await joinRoom(roomId, userId);
                const roomData = await getRoom(roomId);
                setRoom(roomData);
                setError(null);
            } catch (err) {
                if (err instanceof Error && err.message === 'Room is full') {
                    setError('この部屋は満員です');
                } else {
                    setError('部屋に参加できませんでした');
                }
                console.error('Error joining room:', err);
                onLeaveRoom();
            } finally {
                setIsJoining(false);
            }
        };

        joinChatRoom();

        // 部屋から退出
        return () => {
            leaveRoom(roomId, userId).catch(err => {
                console.error('Error leaving room:', err);
            });
        };
    }, [roomId, userId, onLeaveRoom]);

    // メッセージの購読
    useEffect(() => {
        if (isJoining) return;

        const unsubscribeMessages = subscribeToMessages(roomId, (newMessages) => {
            setMessages(newMessages);
        });

        const unsubscribeRoom = subscribeToRoom(roomId, (roomData) => {
            if (!roomData) {
                setError('部屋が存在しません');
                onLeaveRoom();
                return;
            }

            setRoom(roomData);

            // 自分が部屋から削除された場合
            if (!roomData.participants.includes(userId)) {
                setError('部屋から退出しました');
                onLeaveRoom();
            }
        });

        return () => {
            unsubscribeMessages();
            unsubscribeRoom();
        };
    }, [roomId, userId, isJoining, onLeaveRoom]);

    // 新しいメッセージが来たらスクロール
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!newMessage.trim()) return;

        try {
            await sendMessage(roomId, userId, newMessage);
            setNewMessage('');
        } catch (err) {
            console.error('Error sending message:', err);
        }
    };

    const handleLeaveRoom = async () => {
        try {
            await leaveRoom(roomId, userId);
            onLeaveRoom();
        } catch (err) {
            console.error('Error leaving room:', err);
        }
    };

    if (isJoining) {
        return <div className="loading">部屋に参加中...</div>;
    }

    if (error) {
        return (
            <div className="error-container">
                <p className="error">{error}</p>
                <button onClick={onLeaveRoom}>戻る</button>
            </div>
        );
    }

    if (!room) {
        return <div className="loading">部屋情報を読み込み中...</div>;
    }

    return (
        <div className="chat-room">
            <div className="chat-header">
                <h2>{room.name}</h2>
                <div className="room-info">
                    参加者: {room.participants.length} / {room.maxParticipants}
                </div>
                <button onClick={handleLeaveRoom} className="leave-btn">退出</button>
            </div>

            <div className="messages-container">
                {messages.length === 0 ? (
                    <p className="no-messages">メッセージはまだありません</p>
                ) : (
                    messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`message ${msg.senderId === userId ? 'own-message' : 'other-message'}`}
                        >
                            <div className="message-sender">
                                {msg.senderId === userId ? 'あなた' : '相手'}
                            </div>
                            <div className="message-content">{msg.content}</div>
                            <div className="message-time">
                                {msg.timestamp ? new Date(msg.timestamp.seconds * 1000).toLocaleTimeString() : '送信中...'}
                            </div>
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="message-form">
                <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="メッセージを入力..."
                    disabled={room.participants.length < 2}
                />
                <button
                    type="submit"
                    disabled={!newMessage.trim() || room.participants.length < 2}
                >
                    送信
                </button>
            </form>
        </div>
    );
};

export default ChatRoom; 
