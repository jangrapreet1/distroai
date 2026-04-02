export function ScoreRing({ score, size = 32 }: { score: number; size?: number }) {
    const color = score >= 80 ? "var(--green-bright)" : score >= 60 ? "var(--gold)" : score >= 40 ? "var(--orange)" : "var(--red)";
    const r = size / 2 - 3;
    const circ = 2 * Math.PI * r;
    const offset = circ - (score / 100) * circ;
    return (
        <svg width={size} height={size} className="transform -rotate-90">
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={3} />
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={3} strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
        </svg>
    );
}
