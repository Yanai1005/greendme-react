import { useState } from 'react';

type ConnectionStatusProps = {
    status: 'connecting' | 'connected' | 'failed' | 'closed';
    onRetry?: () => void;
    onExit?: () => void;
    onRegenerateSignal?: () => Promise<string>;
    retryCount?: number;
    maxRetries?: number;
};

const ConnectionStatus = (props: ConnectionStatusProps) => {
    const {
        status,
        onRetry,
        onExit,
        onRegenerateSignal,
        retryCount = 0,
        maxRetries = 3
    } = props;

    const [isRegenerating, setIsRegenerating] = useState(false);
    const [regeneratedSignal, setRegeneratedSignal] = useState<string | null>(null);
    const [copySuccess, setCopySuccess] = useState(false);

    let message = '';
    let color = '';
    let icon = '';

    switch (status) {
        case 'connecting':
            message = 'WebRTC接続を確立中です...しばらくお待ちください';
            color = '#2196F3';
            icon = '🔄';
            break;
        case 'connected':
            message = 'P2P接続が確立されました！';
            color = '#4CAF50';
            icon = '✅';
            break;
        case 'failed':
            message = `接続に失敗しました。${retryCount < maxRetries
                ? 'ネットワーク環境を確認して再試行してください。'
                : '再試行回数が上限に達しました。ページを再読み込みしてください。'
                }`;
            color = '#F44336';
            icon = '❌';
            break;
        case 'closed':
            message = '接続が閉じられました。相手が退出したか、ネットワークに問題がある可能性があります。';
            color = '#FF9800';
            icon = '⚠️';
            break;
    }

    const handleRegenerateSignal = async () => {
        if (!onRegenerateSignal) return;

        setIsRegenerating(true);
        try {
            const signal = await onRegenerateSignal();
            setRegeneratedSignal(signal);
        } catch (error) {
            console.error('Failed to regenerate signal:', error);
        } finally {
            setIsRegenerating(false);
        }
    };

    const handleCopyToClipboard = () => {
        if (!regeneratedSignal) return;

        navigator.clipboard.writeText(regeneratedSignal)
            .then(() => {
                setCopySuccess(true);
                setTimeout(() => setCopySuccess(false), 2000);
            })
            .catch(err => {
                console.error('Failed to copy: ', err);
            });
    };

    return (
        <div style={{
            padding: '20px',
            backgroundColor: '#f8f9fa',
            borderRadius: '12px',
            border: `2px solid ${color}`,
            margin: '15px 0',
            textAlign: 'center',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
        }}>
            <div style={{
                fontSize: '18px',
                fontWeight: 'bold',
                color,
                marginBottom: '15px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
            }}>
                <span style={{ fontSize: '24px' }}>{icon}</span>
                接続状態: {status.toUpperCase()}
            </div>

            <p style={{
                marginBottom: '20px',
                lineHeight: '1.5',
                color: '#333'
            }}>
                {message}
            </p>

            {status === 'connecting' && (
                <div style={{
                    fontSize: '14px',
                    color: '#666',
                    marginBottom: '15px',
                    padding: '10px',
                    backgroundColor: '#e3f2fd',
                    borderRadius: '8px'
                }}>
                    <div> NAT越えを試行中...</div>
                    <div> STUN/TURNサーバーと通信中...</div>
                    <div> P2P接続を確立中...</div>
                </div>
            )}

            {(status === 'failed' || status === 'closed') && retryCount > 0 && (
                <div style={{
                    fontSize: '14px',
                    color: '#666',
                    marginBottom: '15px',
                    padding: '10px',
                    backgroundColor: '#fff3e0',
                    borderRadius: '8px'
                }}>
                    再試行回数: {retryCount}/{maxRetries}
                </div>
            )}

            {status === 'failed' && (
                <div style={{
                    fontSize: '13px',
                    color: '#666',
                    marginBottom: '20px',
                    padding: '15px',
                    backgroundColor: '#ffebee',
                    borderRadius: '8px',
                    textAlign: 'left'
                }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '10px' }}>🔧 トラブルシューティング:</div>
                    <ul style={{ margin: 0, paddingLeft: '20px' }}>
                        <li>詰まったら、分かんない</li>
                    </ul>
                </div>
            )}

            {(status === 'failed' || status === 'closed') && (
                <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: '10px',
                    flexWrap: 'wrap'
                }}>
                    {onRetry && retryCount < maxRetries && (
                        <button
                            onClick={onRetry}
                            style={{
                                padding: '12px 24px',
                                backgroundColor: '#4CAF50',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                fontWeight: 'bold',
                                transition: 'background-color 0.3s'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#45a049'}
                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#4CAF50'}
                        >
                            再試行 ({maxRetries - retryCount}回残り)
                        </button>
                    )}

                    {onRegenerateSignal && (
                        <button
                            onClick={handleRegenerateSignal}
                            disabled={isRegenerating}
                            style={{
                                padding: '12px 24px',
                                backgroundColor: isRegenerating ? '#ccc' : '#2196F3',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: isRegenerating ? 'not-allowed' : 'pointer',
                                fontSize: '14px',
                                fontWeight: 'bold',
                                transition: 'background-color 0.3s'
                            }}
                            onMouseOver={(e) => {
                                if (!isRegenerating) {
                                    e.currentTarget.style.backgroundColor = '#1976D2';
                                }
                            }}
                            onMouseOut={(e) => {
                                if (!isRegenerating) {
                                    e.currentTarget.style.backgroundColor = '#2196F3';
                                }
                            }}
                        >
                            {isRegenerating ? '生成中...' : ' 接続コードを再生成'}
                        </button>
                    )}

                    {retryCount >= maxRetries && (
                        <button
                            onClick={() => window.location.reload()}
                            style={{
                                padding: '12px 24px',
                                backgroundColor: '#FF9800',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                fontWeight: 'bold'
                            }}
                        >
                            ページを再読み込み
                        </button>
                    )}

                    {onExit && (
                        <button
                            onClick={onExit}
                            style={{
                                padding: '12px 24px',
                                backgroundColor: '#f44336',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                fontWeight: 'bold'
                            }}
                        >
                            ゲームを終了
                        </button>
                    )}
                </div>
            )}

            {regeneratedSignal && (
                <div style={{ marginTop: '20px', textAlign: 'left' }}>
                    <p style={{ fontWeight: 'bold', marginBottom: '10px' }}>
                        新しい接続コードが生成されました
                    </p>
                    <div style={{ position: 'relative' }}>
                        <textarea
                            readOnly
                            value={regeneratedSignal}
                            style={{
                                width: '100%',
                                height: '120px',
                                padding: '12px',
                                marginBottom: '10px',
                                backgroundColor: '#f0f0f0',
                                border: '1px solid #ccc',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontFamily: 'monospace',
                                resize: 'none'
                            }}
                        />
                        <button
                            onClick={handleCopyToClipboard}
                            style={{
                                position: 'absolute',
                                top: '8px',
                                right: '8px',
                                padding: '6px 12px',
                                backgroundColor: copySuccess ? '#4CAF50' : '#2196F3',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: 'bold'
                            }}
                        >
                            {copySuccess ? ' コピー完了!' : 'コピー'}
                        </button>
                    </div>
                    <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>
                        この接続コードを相手に共有して、再接続を試してください。
                    </p>
                </div>
            )}
            {(status === 'connecting' || status === 'failed') && (
                <div style={{
                    marginTop: '15px',
                    fontSize: '12px',
                    color: '#666',
                    padding: '10px',
                    backgroundColor: '#f5f5f5',
                    borderRadius: '6px'
                }}>
                    同じWi-Fiネットワーク内では接続しやすく、
                    異なるネットワーク間では時間がかかる場合があります。
                </div>
            )}
        </div>
    );
};

export default ConnectionStatus;
