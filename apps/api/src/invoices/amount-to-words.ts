const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(n: number): string {
    if (n < 20) return ones[n];
    return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
}

function threeDigits(n: number): string {
    if (n === 0) return '';
    const h = Math.floor(n / 100);
    const rest = n % 100;
    let s = '';
    if (h) s += ones[h] + ' Hundred';
    if (h && rest) s += ' ';
    if (rest) s += twoDigits(rest);
    return s;
}

/**
 * Convert a number to Indian amount in words.
 * Handles lakhs and crores correctly.
 * Example: 1,23,456.50 → "Rupees One Lakh Twenty Three Thousand Four Hundred Fifty Six and Paise Fifty Only"
 */
export function indianAmountToWords(amount: number): string {
    if (amount === 0) return 'Rupees Zero Only';

    const rupees = Math.floor(amount);
    const paise = Math.round((amount - rupees) * 100);

    if (rupees === 0 && paise > 0) {
        return `Paise ${twoDigits(paise)} Only`;
    }

    const parts: string[] = [];

    // Crores (10,000,000+)
    const crores = Math.floor(rupees / 10000000);
    if (crores > 0) parts.push(threeDigits(crores) + ' Crore');

    // Lakhs (100,000)
    const lakhs = Math.floor((rupees % 10000000) / 100000);
    if (lakhs > 0) parts.push(twoDigits(lakhs) + ' Lakh');

    // Thousands (1,000)
    const thousands = Math.floor((rupees % 100000) / 1000);
    if (thousands > 0) parts.push(twoDigits(thousands) + ' Thousand');

    // Hundreds and rest
    const rest = rupees % 1000;
    if (rest > 0) parts.push(threeDigits(rest));

    let result = 'Rupees ' + parts.join(' ');

    if (paise > 0) {
        result += ' and Paise ' + twoDigits(paise);
    }

    return result + ' Only';
}
