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
            'こんにちは',
        ],
        medium: [
            'タイピング速度を上げるためには、練習が不可欠です',
            'このゲームはタイピングのスキルを向上させるために作られました',
        ],
        hard: [
            'タイピング速度を上げるためには、練習が不可欠です',
            'このゲームはタイピングのスキルを向上させるために作られました',
            '難しい文章をタイピングすることで、スキルを向上させることができます',
        ]
    };

    const levelTexts = texts[level] || texts.medium;
    const randomIndex = Math.floor(Math.random() * levelTexts.length);

    return levelTexts[randomIndex];
};
