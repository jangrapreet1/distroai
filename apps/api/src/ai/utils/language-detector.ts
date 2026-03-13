export function detectLanguage(text: string): 'hi' | 'en' {
    // Devanagari Unicode range: \u0900-\u097F
    const hindiChars = (text.match(/[\u0900-\u097F]/g) || []).length;
    const totalChars = text.replace(/\s/g, '').length || 1;

    if (hindiChars / totalChars > 0.1) return 'hi';

    // Hinglish detection (common romanized Hindi words)
    const hinglishWords = ['kya', 'kitna', 'kaun', 'kab', 'kaise', 'mujhe', 'mere', 'hamara', 'aaj', 'kal', 'abhi', 'bohot', 'bahut', 'nahi', 'haan', 'theek', 'accha'];
    const words = text.toLowerCase().split(/\s+/);
    const hinglishCount = words.filter(w => hinglishWords.includes(w)).length;

    return hinglishCount >= 2 ? 'hi' : 'en';
}
