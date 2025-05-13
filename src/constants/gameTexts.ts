export interface DifficultyLevel {
    id: string;
    text: string;
    label: string;
}

export const DIFFICULTY_LEVELS: Record<string, DifficultyLevel> = {
    EASY: {
        id: 'easy',
        text: 'こんにちは、これは初級なタイピングゲームです。',
        label: '簡単'
    },
    MEDIUM: {
        id: 'medium',
        text: 'こんにちは、これは中級なタイピングゲームです。',
        label: '中級'
    },
    HARD: {
        id: 'hard',
        text: 'こんにちは、これは上級なタイピングゲームです。',
        label: '難しい'
    }
};

export const getRandomText = (level: string = 'medium'): string => {
    const texts: Record<string, string[]> = {
        easy: [
            'こんにちは、世界',
            'タイピングの練習をしましょう',
            'シンプルな文章から始めましょう'
        ],
        medium: [
            'キーボードの練習は毎日続けることが大切です',
            'プログラミングには正確なタイピングが必要です',
            'ショートカットキーを覚えると作業効率が上がります'
        ],
        hard: [
            'タッチタイピングとは、キーボードを見ずに文字入力することを指します。慣れると入力速度が飛躍的に向上します。',
            'ReactとFirebaseを組み合わせると、リアルタイムで同期するWebアプリケーションを簡単に作成できます。',
            'プログラミング学習において最も重要なことは、継続的な実践とフィードバックのサイクルを回すことです。'
        ]
    };

    const levelTexts = texts[level] || texts.medium;
    const randomIndex = Math.floor(Math.random() * levelTexts.length);

    return levelTexts[randomIndex];
};
