import { db } from '../firebase/config';
import {
    collection,
    doc,
    setDoc,
    onSnapshot,
    deleteDoc,
} from 'firebase/firestore';

const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ]
};

export class PeerConnection {
    private connection: RTCPeerConnection;
    private dataChannel: RTCDataChannel | null = null;
    private roomId: string;
    private playerId: string;
    private onDataCallback: ((data: any) => void) | null = null;
    private signallingCleanup: (() => void) | null = null;

    constructor(roomId: string, playerId: string) {
        this.roomId = roomId;
        this.playerId = playerId;
        this.connection = new RTCPeerConnection(configuration);

        // ICE候補の処理
        this.connection.onicecandidate = (event) => {
            if (event.candidate) {
                this.sendSignalData('ice-candidate', event.candidate);
            }
        };

        // 接続状態の監視
        this.connection.onconnectionstatechange = () => {
            console.log('Connection state:', this.connection.connectionState);
        };

        // データチャネルの受信設定
        this.connection.ondatachannel = (event) => {
            const receiveChannel = event.channel;
            this.setupDataChannel(receiveChannel);
        };
    }

    // データチャネルのセットアップ
    private setupDataChannel(channel: RTCDataChannel) {
        channel.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (this.onDataCallback) {
                    this.onDataCallback(data);
                }
            } catch (error) {
                console.error('Error parsing data channel message:', error);
            }
        };

        channel.onopen = () => {
            console.log('Data channel is open');
        };

        channel.onclose = () => {
            console.log('Data channel is closed');
        };
    }

    // データチャネルを作成する（部屋の作成者用）
    public createDataChannel() {
        this.dataChannel = this.connection.createDataChannel('gameData');
        this.setupDataChannel(this.dataChannel);
        return this.dataChannel;
    }

    // オファーを作成して送信する（部屋の作成者用）
    public async createOffer() {
        try {
            const offer = await this.connection.createOffer();
            await this.connection.setLocalDescription(offer);
            this.sendSignalData('offer', this.connection.localDescription);
        } catch (error) {
            console.error('Error creating offer:', error);
        }
    }

    // 受信したオファーに応答する（参加者用）
    public async handleOffer(offer: RTCSessionDescriptionInit) {
        try {
            await this.connection.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await this.connection.createAnswer();
            await this.connection.setLocalDescription(answer);
            this.sendSignalData('answer', this.connection.localDescription);
        } catch (error) {
            console.error('Error handling offer:', error);
        }
    }

    // 受信した応答を処理する（部屋の作成者用）
    public async handleAnswer(answer: RTCSessionDescriptionInit) {
        try {
            await this.connection.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (error) {
            console.error('Error handling answer:', error);
        }
    }

    // ICE候補を追加する
    public async addIceCandidate(candidate: RTCIceCandidateInit) {
        try {
            await this.connection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
            console.error('Error adding ice candidate:', error);
        }
    }

    // シグナリングデータをFirestoreに送信
    private async sendSignalData(type: string, data: any) {
        try {
            const signalRef = doc(collection(db, 'rooms', this.roomId, 'signals'), this.playerId);
            await setDoc(signalRef, {
                type,
                data,
                timestamp: Date.now(),
                playerId: this.playerId
            });
        } catch (error) {
            console.error('Error sending signal data:', error);
        }
    }

    // シグナリングデータのリスニングを開始
    public listenForSignals(targetPlayerId?: string) {
        const signalsRef = collection(db, 'rooms', this.roomId, 'signals');

        let unsubscribe: (() => void) | null = null;

        if (targetPlayerId) {
            // 特定のプレイヤーからのシグナルをリッスン（部屋の作成者用）
            unsubscribe = onSnapshot(doc(signalsRef, targetPlayerId), (snapshot) => {
                const data = snapshot.data();
                if (data && data.playerId !== this.playerId) {
                    this.handleSignalData(data);
                }
            });
        } else {
            // すべてのシグナルをリッスン（参加者用）
            unsubscribe = onSnapshot(signalsRef, (snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'added' || change.type === 'modified') {
                        const data = change.doc.data();
                        if (data && data.playerId !== this.playerId) {
                            this.handleSignalData(data);
                        }
                    }
                });
            });
        }

        this.signallingCleanup = unsubscribe;
        return unsubscribe;
    }

    // シグナリングデータの処理
    private async handleSignalData(data: any) {
        try {
            switch (data.type) {
                case 'offer':
                    await this.handleOffer(data.data);
                    break;
                case 'answer':
                    await this.handleAnswer(data.data);
                    break;
                case 'ice-candidate':
                    await this.addIceCandidate(data.data);
                    break;
                default:
                    console.warn('Unknown signal type:', data.type);
            }
        } catch (error) {
            console.error('Error handling signal data:', error);
        }
    }

    // データを送信する
    public sendData(data: any) {
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
            this.dataChannel.send(JSON.stringify(data));
        } else {
            console.warn('Data channel is not open');
        }
    }

    // データ受信時のコールバックを設定
    public onData(callback: (data: any) => void) {
        this.onDataCallback = callback;
    }

    // 接続をクリーンアップする
    public async cleanup() {
        if (this.signallingCleanup) {
            this.signallingCleanup();
        }

        if (this.dataChannel) {
            this.dataChannel.close();
        }

        this.connection.close();

        // Firestoreの信号データを削除
        try {
            const signalRef = doc(collection(db, 'rooms', this.roomId, 'signals'), this.playerId);
            await deleteDoc(signalRef);
        } catch (error) {
            console.error('Error cleaning up signals:', error);
        }
    }
}
