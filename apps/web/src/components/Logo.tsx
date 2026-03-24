export function Logo({ className = "w-8 h-8", textCls = "text-xl", showText = true }: { className?: string, textCls?: string, showText?: boolean }) {
    return (
        <div className="flex items-center gap-2.5">
            <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={`${className} shrink-0`}>
                <path d="M20 3.5L35 12V28L20 36.5L5 28V12L20 3.5Z" fill="url(#paint0_linear_logo)" fillOpacity="0.15" stroke="url(#paint0_linear_logo)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M20 19.5L35 12" stroke="url(#paint0_linear_logo)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M5 12L20 19.5V36.5" stroke="url(#paint0_linear_logo)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

                <path d="M20 8.5L22 14.5L28 16.5L22 18.5L20 24.5L18 18.5L12 16.5L18 14.5L20 8.5Z" fill="var(--gold)" />

                <defs>
                    <linearGradient id="paint0_linear_logo" x1="5" y1="3.5" x2="35" y2="36.5" gradientUnits="userSpaceOnUse">
                        <stop stopColor="var(--gold)" />
                        <stop offset="1" stopColor="#a78bfa" />
                    </linearGradient>
                </defs>
            </svg>
            {showText && (
                <span className={`font-bold tracking-tight ${textCls}`} style={{ fontFamily: "var(--font-playfair)" }}>
                    DistroAI
                </span>
            )}
        </div>
    );
}
