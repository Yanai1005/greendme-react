// WebRTC types are now globally available in modern browsers
interface ConnectionData {
    type: 'offer' | 'answer';
    sdp: string;
}

interface WebRTCData {
    offer?: ConnectionData;
    answer?: ConnectionData;
    candidates: RTCIceCandidate[];
}



export class SimpleP2P {
    private peerConnection: RTCPeerConnection = new RTCPeerConnection();
    private dataChannel: RTCDataChannel | null = null;
    private iceCandidates: RTCIceCandidate[] = [];
    private messageQueue: string[] = [];
    private connectionReady = false;
    private messageListeners: ((message: string) => void)[] = [];
    private connectionTimeoutId: NodeJS.Timeout | null = null;
    private connectionAttempts = 0;
    private maxConnectionAttempts = 3;

    constructor() {
        this.initializePeerConnection();
    }

    private initializePeerConnection() {
        const configuration: RTCConfiguration = {
            iceServers: [
                {
                    urls: [
                        'stun:stun1.l.google.com:19302',
                        'stun:stun2.l.google.com:19302',
                        'stun:stun3.l.google.com:19302',
                        'stun:stun4.l.google.com:19302'
                    ]
                },
                {
                    urls: 'turn:numb.viagenie.ca',
                    credential: 'muazkh',
                    username: 'webrtc@live.com'
                }
            ],
            iceCandidatePoolSize: 10
        };

        this.peerConnection = new RTCPeerConnection(configuration);

        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('New ICE candidate:', event.candidate);
                this.iceCandidates.push(event.candidate);
            }
        };

        this.peerConnection.onicegatheringstatechange = () => {
            console.log('ICE gathering state:', this.peerConnection.iceGatheringState);
            if (this.peerConnection.iceGatheringState === 'complete') {
                console.log('ICE gathering complete with', this.iceCandidates.length, 'candidates');
            }
        };

        this.peerConnection.onconnectionstatechange = () => {
            console.log('Connection state changed to:', this.peerConnection.connectionState);

            // 接続状態が変わったときに通知
            if (this.peerConnection.connectionState === 'connected') {
                if (this.connectionTimeoutId) {
                    clearTimeout(this.connectionTimeoutId);
                    this.connectionTimeoutId = null;
                }
                this.processMessageQueue();
            } else if (this.peerConnection.connectionState === 'failed') {
                if (this.connectionAttempts < this.maxConnectionAttempts) {
                    console.log(`Connection failed. Retrying (${this.connectionAttempts + 1}/${this.maxConnectionAttempts})...`);
                    this.reconnect();
                }
            }
        };

        this.peerConnection.oniceconnectionstatechange = () => {
            console.log('ICE connection state changed to:', this.peerConnection.iceConnectionState);

            if (this.peerConnection.iceConnectionState === 'disconnected' ||
                this.peerConnection.iceConnectionState === 'failed') {
                if (this.connectionAttempts < this.maxConnectionAttempts) {
                    console.log(`ICE connection failed. Retrying (${this.connectionAttempts + 1}/${this.maxConnectionAttempts})...`);
                    this.reconnect();
                }
            }
        };
    }

    private reconnect() {
        this.connectionAttempts++;

        // 既存の接続をクリーンアップ
        if (this.dataChannel) {
            this.dataChannel.close();
            this.dataChannel = null;
        }

        this.peerConnection.close();
        this.iceCandidates = [];

        // 新しい接続を初期化
        this.initializePeerConnection();

        // 再接続のコールバックを通知
        this.messageListeners.forEach(listener => {
            try {
                listener(JSON.stringify({ type: 'connectionRetry', attempt: this.connectionAttempts }));
            } catch (error) {
                console.error('Error notifying connection retry:', error);
            }
        });
    }

    private setConnectionTimeout() {
        if (this.connectionTimeoutId) {
            clearTimeout(this.connectionTimeoutId);
        }

        // 30秒のタイムアウトを設定
        this.connectionTimeoutId = setTimeout(() => {
            if (this.peerConnection.connectionState !== 'connected' &&
                this.peerConnection.iceConnectionState !== 'connected' &&
                (!this.dataChannel || this.dataChannel.readyState !== 'open')) {

                console.log('Connection timeout. Connection state:', this.peerConnection.connectionState);
                console.log('ICE connection state:', this.peerConnection.iceConnectionState);
                console.log('Data channel state:', this.dataChannel?.readyState || 'null');

                if (this.connectionAttempts < this.maxConnectionAttempts) {
                    console.log(`Connection timed out. Retrying (${this.connectionAttempts + 1}/${this.maxConnectionAttempts})...`);
                    this.reconnect();
                } else {
                    // 最大試行回数に達した場合、失敗を通知
                    this.messageListeners.forEach(listener => {
                        try {
                            listener(JSON.stringify({
                                type: 'connectionFailed',
                                reason: 'Connection timeout after multiple attempts'
                            }));
                        } catch (error) {
                            console.error('Error notifying connection failure:', error);
                        }
                    });
                }
            }
        }, 30000); // 30秒
    }

    async createOffer(): Promise<WebRTCData> {
        try {
            this.connectionAttempts = 0;
            this.setConnectionTimeout();

            this.dataChannel = this.peerConnection.createDataChannel('gameChannel', {
                ordered: true  // 順序付きデータチャネル
            });
            this.setupDataChannel();

            const offer = await this.peerConnection.createOffer({
                offerToReceiveAudio: false,
                offerToReceiveVideo: false
            });
            console.log('Created offer:', offer);
            await this.peerConnection.setLocalDescription(offer);

            // ICE candidateの収集を待つ - より多くの候補を収集するために待機時間を増やす
            await new Promise(resolve => {
                const checkIceCandidates = () => {
                    if (this.peerConnection.iceGatheringState === 'complete') {
                        resolve(null);
                    } else if (this.iceCandidates.length >= 5) {
                        // 十分な数のICE候補が集まったら続行
                        setTimeout(resolve, 1000);
                    } else {
                        setTimeout(checkIceCandidates, 500);
                    }
                };
                setTimeout(checkIceCandidates, 500);
            });

            const offerData: ConnectionData = {
                type: 'offer',
                sdp: offer.sdp || ''
            };

            return {
                offer: offerData,
                candidates: this.iceCandidates
            };
        } catch (error) {
            console.error('Error creating offer:', error);
            throw error;
        }
    }

    async handleAnswer(data: WebRTCData): Promise<void> {
        try {
            if (!data.answer || !data.answer.sdp) {
                throw new Error('Invalid answer data received');
            }

            console.log('Handling answer:', data.answer);
            const answerDesc = new RTCSessionDescription({
                type: 'answer',
                sdp: data.answer.sdp
            });

            await this.peerConnection.setRemoteDescription(answerDesc);
            console.log('Remote description set successfully');

            // ICE candidateの追加 - 順番にプロセス
            for (const candidate of data.candidates) {
                try {
                    console.log('Adding ICE candidate:', candidate);
                    await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (error) {
                    console.warn('Error adding ICE candidate:', error);
                    // 個別のICE候補の追加に失敗しても続行
                }
            }
        } catch (error) {
            console.error('Error handling answer:', error);
            throw error;
        }
    }

    async joinRoom(data: WebRTCData): Promise<WebRTCData> {
        try {
            this.connectionAttempts = 0;
            this.setConnectionTimeout();

            if (!data.offer || !data.offer.sdp) {
                throw new Error('Invalid offer data received');
            }

            console.log('Joining room with offer:', data.offer);
            const offerDesc = new RTCSessionDescription({
                type: 'offer',
                sdp: data.offer.sdp
            });

            await this.peerConnection.setRemoteDescription(offerDesc);

            // ICE candidateの追加 - 順番にプロセス
            for (const candidate of data.candidates) {
                try {
                    console.log('Adding ICE candidate:', candidate);
                    await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (error) {
                    console.warn('Error adding ICE candidate:', error);
                    // 個別のICE候補の追加に失敗しても続行
                }
            }

            this.peerConnection.ondatachannel = (event: RTCDataChannelEvent) => {
                this.dataChannel = event.channel;
                this.setupDataChannel();
            };

            const answer = await this.peerConnection.createAnswer();
            console.log('Created answer:', answer);
            await this.peerConnection.setLocalDescription(answer);

            // ICE candidateの収集を待つ - より多くの候補を収集するために待機時間を増やす
            await new Promise(resolve => {
                const checkIceCandidates = () => {
                    if (this.peerConnection.iceGatheringState === 'complete') {
                        resolve(null);
                    } else if (this.iceCandidates.length >= 5) {
                        // 十分な数のICE候補が集まったら続行
                        setTimeout(resolve, 1000);
                    } else {
                        setTimeout(checkIceCandidates, 500);
                    }
                };
                setTimeout(checkIceCandidates, 500);
            });

            const answerData: ConnectionData = {
                type: 'answer',
                sdp: answer.sdp || ''
            };

            return {
                answer: answerData,
                candidates: this.iceCandidates
            };
        } catch (error) {
            console.error('Error joining room:', error);
            throw error;
        }
    }

    private setupDataChannel() {
        if (!this.dataChannel) return;

        this.dataChannel.onopen = () => {
            console.log('Data channel is open');
            this.connectionReady = true;

            // チャネルが開いたら、通知メッセージを送信
            this.sendMessage(JSON.stringify({ type: 'connectionEstablished', timestamp: Date.now() }));

            // 待機中のメッセージがあれば処理
            this.processMessageQueue();

            // タイムアウトをクリア
            if (this.connectionTimeoutId) {
                clearTimeout(this.connectionTimeoutId);
                this.connectionTimeoutId = null;
            }

            // 接続成功を通知
            this.messageListeners.forEach(listener => {
                try {
                    listener(JSON.stringify({ type: 'connectionSuccess' }));
                } catch (error) {
                    console.error('Error notifying connection success:', error);
                }
            });
        };

        this.dataChannel.onclose = () => {
            console.log('Data channel is closed');
            this.connectionReady = false;
        };

        this.dataChannel.onerror = (error) => {
            console.error('Data channel error:', error);
            this.connectionReady = false;
        };

        this.dataChannel.onmessage = (event: MessageEvent) => {
            console.log('Received message:', event.data);

            try {
                const data = JSON.parse(event.data);
                // 接続確立メッセージの場合、キューに入れずに処理
                if (data.type === 'connectionEstablished' || data.type === 'connectionTest') {
                    console.log('Connection confirmation received');
                    return;
                }
            } catch (error) {
                // JSONでない場合は無視
            }

            // 全てのリスナーにメッセージを通知
            this.messageListeners.forEach(listener => {
                try {
                    listener(event.data);
                } catch (error) {
                    console.error('Error in message listener:', error);
                }
            });
        };
    }

    private processMessageQueue() {
        if (this.connectionReady && this.dataChannel?.readyState === 'open' && this.messageQueue.length > 0) {
            console.log(`Processing ${this.messageQueue.length} queued messages`);

            while (this.messageQueue.length > 0) {
                const message = this.messageQueue.shift();
                if (message) {
                    this.dataChannel.send(message);
                }
            }
        }
    }

    sendMessage(message: string): void {
        if (this.connectionReady && this.dataChannel?.readyState === 'open') {
            this.dataChannel.send(message);
        } else {
            // 接続ができていなければキューに追加
            console.warn('Data channel is not ready. Queuing message:', message);
            this.messageQueue.push(message);
        }
    }

    onMessage(callback: (message: string) => void): void {
        this.messageListeners.push(callback);
    }

    getConnectionState(): string {
        return this.peerConnection.connectionState;
    }

    getDataChannelState(): string {
        return this.dataChannel?.readyState || 'closed';
    }

    isReady(): boolean {
        return this.connectionReady && this.dataChannel?.readyState === 'open';
    }
} 
