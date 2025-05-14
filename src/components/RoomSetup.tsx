import React, { useState, useEffect } from 'react';
import { SimpleP2P } from '../services/SimpleP2P';

interface RoomSetupProps {
    onConnectionEstablished: (p2p: SimpleP2P) => void;
}

export const RoomSetup: React.FC<RoomSetupProps> = ({ onConnectionEstablished }) => {
    const [p2p] = useState(() => new SimpleP2P());
    const [connectionInfo, setConnectionInfo] = useState('');
    const [isCreatingRoom, setIsCreatingRoom] = useState(false);
    const [isJoiningRoom, setIsJoiningRoom] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isAnswerReceived, setIsAnswerReceived] = useState(false);
    const [isConnectionReady, setIsConnectionReady] = useState(false);

    // 接続状態を監視
    useEffect(() => {
        if (isConnectionReady) {
            const checkConnectionInterval = setInterval(() => {
                const dataChannelState = p2p.getDataChannelState();
                const connectionState = p2p.getConnectionState();

                console.log('Checking connection:', { dataChannelState, connectionState });

                if (dataChannelState === 'open') {
                    clearInterval(checkConnectionInterval);
                    setConnectionStatus('Connection established! Moving to game...');

                    // 接続が確立されたことを確認したら、ゲームに進む
                    setTimeout(() => {
                        onConnectionEstablished(p2p);
                    }, 1000);
                } else if (connectionState === 'failed' || connectionState === 'disconnected' || connectionState === 'closed') {
                    clearInterval(checkConnectionInterval);
                    setError('Connection failed. Please try again.');
                    setConnectionStatus('Connection failed');
                }
            }, 1000);

            return () => clearInterval(checkConnectionInterval);
        }
    }, [isConnectionReady, p2p, onConnectionEstablished]);

    // 接続確立のテスト用メッセージを送信
    const sendConnectionTest = () => {
        try {
            p2p.sendMessage(JSON.stringify({ type: 'connectionTest', timestamp: Date.now() }));
        } catch (error) {
            console.error('Error sending test message:', error);
        }
    };

    const handleCreateRoom = async () => {
        setIsCreatingRoom(true);
        setError(null);
        try {
            const data = await p2p.createOffer();
            console.log('Created offer data:', data);
            setConnectionInfo(JSON.stringify(data, null, 2));
            setConnectionStatus('Waiting for peer to join...');
        } catch (error) {
            console.error('Error creating room:', error);
            setConnectionStatus('Error creating room');
            setError(error instanceof Error ? error.message : 'Unknown error');
        }
    };

    const handleJoinRoom = async () => {
        setIsJoiningRoom(true);
        setError(null);
    };

    const handleSubmitJoin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        try {
            let parsedData;
            try {
                parsedData = JSON.parse(connectionInfo);
            } catch (error) {
                throw new Error('Invalid connection info format. Please check the data and try again.');
            }

            console.log('Joining with data:', parsedData);
            const responseData = await p2p.joinRoom(parsedData);
            console.log('Join response data:', responseData);
            setConnectionInfo(JSON.stringify(responseData, null, 2));
            setConnectionStatus('Connected! Waiting for host to confirm...');

            // 応答を送信した後、接続準備完了をマーク
            setIsConnectionReady(true);

            // 接続テストメッセージを定期的に送信
            const testInterval = setInterval(sendConnectionTest, 2000);
            setTimeout(() => clearInterval(testInterval), 10000);
        } catch (error) {
            console.error('Error joining room:', error);
            setConnectionStatus('Error joining room');
            setError(error instanceof Error ? error.message : 'Unknown error');
        }
    };

    const handleSubmitAnswer = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        try {
            let parsedData;
            try {
                parsedData = JSON.parse(connectionInfo);
                setIsAnswerReceived(true);
            } catch (error) {
                throw new Error('Invalid connection info format. Please check the data and try again.');
            }

            console.log('Handling answer data:', parsedData);
            await p2p.handleAnswer(parsedData);
            setConnectionStatus('Processing connection...');

            // 応答を処理した後、接続準備完了をマーク
            setIsConnectionReady(true);

            // 接続テストメッセージを定期的に送信
            const testInterval = setInterval(sendConnectionTest, 2000);
            setTimeout(() => clearInterval(testInterval), 10000);
        } catch (error) {
            console.error('Error handling answer:', error);
            setConnectionStatus('Error establishing connection');
            setError(error instanceof Error ? error.message : 'Unknown error');
        }
    };

    const getConnectionStatusClass = () => {
        if (connectionStatus.includes('Error') || connectionStatus.includes('failed')) {
            return 'text-red-500';
        } else if (connectionStatus.includes('Connected') || connectionStatus.includes('established')) {
            return 'text-green-500';
        }
        return 'text-blue-500';
    };

    if (!isCreatingRoom && !isJoiningRoom) {
        return (
            <div className="flex flex-col gap-4 p-4">
                <button
                    onClick={handleCreateRoom}
                    className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
                >
                    Create Room
                </button>
                <button
                    onClick={handleJoinRoom}
                    className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition-colors"
                >
                    Join Room
                </button>
            </div>
        );
    }

    return (
        <div className="p-4">
            <form onSubmit={isCreatingRoom ? handleSubmitAnswer : handleSubmitJoin}>
                <div className="flex flex-col gap-4">
                    {connectionStatus && (
                        <div className={`text-center font-semibold ${getConnectionStatusClass()}`}>
                            {connectionStatus}
                        </div>
                    )}
                    {error && (
                        <div className="text-red-500 text-center font-semibold">
                            {error}
                        </div>
                    )}
                    {isCreatingRoom && !isAnswerReceived && (
                        <div>
                            <p>Share this connection info with the other player:</p>
                            <textarea
                                readOnly
                                value={connectionInfo}
                                className="w-full p-2 border rounded font-mono text-sm h-48"
                            />
                        </div>
                    )}
                    {(isJoiningRoom || (isCreatingRoom && !isAnswerReceived)) && (
                        <div>
                            <p>
                                {isJoiningRoom
                                    ? "Enter the host's connection info:"
                                    : "Enter the other player's response:"}
                            </p>
                            <textarea
                                value={connectionInfo}
                                onChange={(e) => setConnectionInfo(e.target.value)}
                                className="w-full p-2 border rounded font-mono text-sm h-48"
                            />
                        </div>
                    )}

                    {!isConnectionReady && (
                        <button
                            type="submit"
                            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
                        >
                            {isJoiningRoom ? 'Join' : 'Connect'}
                        </button>
                    )}

                    {isConnectionReady && (
                        <div className="text-center">
                            <p className="text-blue-500 animate-pulse">
                                Establishing connection... Please wait.
                            </p>
                            <div className="mt-2 flex justify-center">
                                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        </div>
                    )}
                </div>
            </form>
        </div>
    );
}; 
