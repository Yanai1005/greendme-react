// src/utils/gameTexts.ts

/**
 * 難易度レベル
 */
export type DifficultyLevel = 'easy' | 'medium' | 'hard';

/**
 * 各難易度のサンプルテキスト
 */
const TEXTS: Record<DifficultyLevel, string[]> = {
    easy: [
        'こんにちは、これは初級なタイピングゲームです。',
        '日本語でタイピングの練習をしましょう。',
        'タイピングは指先を使った運動です。'
    ],
    medium: [
        'タイピング速度を上げるためには、練習が不可欠です。正確さも重要なので、ゆっくりでも正確に入力しましょう。',
        'このゲームはタイピングのスキルを向上させるために作られました。毎日少しずつ練習して上達しましょう。',
        '指の位置を確認せずにタイピングすることをタッチタイピングと言います。慣れると入力速度が大幅に向上します。'
    ],
    hard: [
        'タイピングスキルは現代社会において非常に重要です。特にプログラマーやライターなど、コンピューターを使う職業では必須のスキルとなっています。毎日少しずつ練習を続けることで、着実に能力を向上させることができます。',
        'タッチタイピングとは、キーボードを見ずに入力する技術のことです。最初は難しく感じるかもしれませんが、継続的な練習によって習得できます。正しい指の位置からスタートし、徐々に速度を上げていくことが効果的です。',
        '日本語入力では、ローマ字入力とかな入力の2つの方法があります。どちらが優れているということはなく、使いやすい方を選ぶとよいでしょう。ただし、どちらも基本的なタッチタイピングの技術が役立ちます。'
    ]
};

/**
 * ランダムなテキストを取得する
 * @param level 難易度レベル（デフォルトは'medium'）
 * @returns ランダムに選ばれたテキスト
 */
export function getRandomText(level: DifficultyLevel = 'medium'): string {
    const texts = TEXTS[level];
    const randomIndex = Math.floor(Math.random() * texts.length);
    return texts[randomIndex];
}

/**
 * 指定した難易度のすべてのテキストを取得する
 * @param level 難易度レベル
 * @returns テキストの配列
 */
export function getAllTexts(level: DifficultyLevel): string[] {
    return TEXTS[level];
}

/**
 * 利用可能な難易度レベルをすべて取得する
 * @returns 難易度レベルの配列
 */
export function getDifficultyLevels(): DifficultyLevel[] {
    return ['easy', 'medium', 'hard'];
}
