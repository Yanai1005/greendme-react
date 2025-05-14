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
    private peerConnection: RTCPeerConnection;
    private dataChannel: RTCDataChannel | null = null;
    private iceCandidates: RTCIceCandidate[] = [];
    private messageQueue: string[] = [];
    private connectionReady = false;
    private messageListeners: ((message: string) => void)[] = [];

    constructor() {
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

        this.peerConnection.onconnectionstatechange = () => {
            console.log('Connection state:', this.peerConnection.connectionState);
            // 接続状態が変わったときに通知
            if (this.peerConnection.connectionState === 'connected') {
                this.processMessageQueue();
            }
        };

        this.peerConnection.oniceconnectionstatechange = () => {
            console.log('ICE connection state:', this.peerConnection.iceConnectionState);
        };
    }

    async createOffer(): Promise<WebRTCData> {
        try {
            this.dataChannel = this.peerConnection.createDataChannel('gameChannel');
            this.setupDataChannel();

            const offer = await this.peerConnection.createOffer();
            console.log('Created offer:', offer);
            await this.peerConnection.setLocalDescription(offer);

            // ICE candidateの収集を待つ
            await new Promise(resolve => setTimeout(resolve, 2000));

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

            for (const candidate of data.candidates) {
                console.log('Adding ICE candidate:', candidate);
                await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            }
        } catch (error) {
            console.error('Error handling answer:', error);
            throw error;
        }
    }

    async joinRoom(data: WebRTCData): Promise<WebRTCData> {
        try {
            if (!data.offer || !data.offer.sdp) {
                throw new Error('Invalid offer data received');
            }

            console.log('Joining room with offer:', data.offer);
            const offerDesc = new RTCSessionDescription({
                type: 'offer',
                sdp: data.offer.sdp
            });

            await this.peerConnection.setRemoteDescription(offerDesc);

            for (const candidate of data.candidates) {
                console.log('Adding ICE candidate:', candidate);
                await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            }

            this.peerConnection.ondatachannel = (event: RTCDataChannelEvent) => {
                this.dataChannel = event.channel;
                this.setupDataChannel();
            };

            const answer = await this.peerConnection.createAnswer();
            console.log('Created answer:', answer);
            await this.peerConnection.setLocalDescription(answer);

            // ICE candidateの収集を待つ
            await new Promise(resolve => setTimeout(resolve, 2000));

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
