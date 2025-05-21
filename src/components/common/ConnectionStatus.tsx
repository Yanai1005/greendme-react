import { useState } from 'react';

interface ConnectionStatusProps {
    status: 'connecting' | 'connected' | 'failed' | 'closed';
    onRetry?: () => void;
    onExit?: () => void;
    onRegenerateSignal?: () => Promise<string>;
}

const ConnectionStatus = (props: ConnectionStatusProps) => {
    const { status, onRetry, onExit, onRegenerateSignal } = props;

    const [isRegenerating, setIsRegenerating] = useState(false);
    const [regeneratedSignal, setRegeneratedSignal] = useState<string | null>(null);
    const [copySuccess, setCopySuccess] = useState(false);

    let message = '';
    let color = '';

    switch (status) {
        case 'connecting':
            message = '接続中...しばらくお待ちください';
            color = '#2196F3';
            break;
        case 'connected':
            message = '接続されました！';
            color = '#4CAF50';
            break;
        case 'failed':
            message = '接続に失敗しました。インターネット接続を確認して、もう一度お試しください。';
            color = '#F44336';
            break;
        case 'closed':
            message = '接続が閉じられました。相手が退出したか、ネットワークに問題がある可能性があります。';
            color = '#FF9800';
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
            padding: '15px',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px',
            border: `1px solid ${color}`,
            margin: '15px 0',
            textAlign: 'center'
        }}>
            <div style={{ fontWeight: 'bold', color, marginBottom: '10px' }}>
                {status === 'connecting' && '⏳'}
                {status === 'connected' && '✅'}
                {status === 'failed' && '❌'}
                {status === 'closed' && '⚠️'}
                {' '}接続状態: {status}
            </div>
            <p>{message}</p>

            {(status === 'failed' || status === 'closed') && (
                <div style={{ marginTop: '15px' }}>
                    {onRetry && (
                        <button
                            onClick={onRetry}
                            style={{
                                padding: '8px 16px',
                                backgroundColor: '#4CAF50',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                marginRight: '10px'
                            }}
                        >
                            再試行
                        </button>
                    )}

                    {onRegenerateSignal && (
                        <button
                            onClick={handleRegenerateSignal}
                            disabled={isRegenerating}
                            style={{
                                padding: '8px 16px',
                                backgroundColor: '#2196F3',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                marginRight: '10px'
                            }}
                        >
                            {isRegenerating ? '生成中...' : '接続コードを再生成'}
                        </button>
                    )}

                    {onExit && (
                        <button
                            onClick={onExit}
                            style={{
                                padding: '8px 16px',
                                backgroundColor: '#f44336',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer'
                            }}
                        >
                            終了
                        </button>
                    )}
                </div>
            )}

            {regeneratedSignal && (
                <div style={{ marginTop: '15px', textAlign: 'left' }}>
                    <p>新しい接続コードが生成されました。これを相手に共有してください:</p>
                    <div style={{ position: 'relative' }}>
                        <textarea
                            readOnly
                            value={regeneratedSignal}
                            style={{
                                width: '100%',
                                height: '100px',
                                padding: '8px',
                                marginBottom: '10px',
                                backgroundColor: '#f0f0f0',
                                border: '1px solid #ccc',
                                borderRadius: '4px'
                            }}
                        />
                        <button
                            onClick={handleCopyToClipboard}
                            style={{
                                position: 'absolute',
                                top: '5px',
                                right: '5px',
                                padding: '4px 8px',
                                backgroundColor: copySuccess ? '#4CAF50' : '#2196F3',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '12px'
                            }}
                        >
                            {copySuccess ? 'コピーしました！' : 'コピー'}
                        </button>
                    </div>
                    <p style={{ fontSize: '12px', color: '#666' }}>
                        相手は「応答コードを処理」ページで、この新しいコードを入力する必要があります。
                    </p>
                </div>
            )}
        </div>
    );
};

export default ConnectionStatus;
