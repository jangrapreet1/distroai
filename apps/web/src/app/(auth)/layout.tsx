export default function AuthLayout({ children }: { children: React.ReactNode }) {
    return (
        <div
            className="min-h-screen bg-[var(--bg-primary,#07070E)] text-[var(--text-primary,#EDEDEF)]"
            style={{ backgroundColor: "#07070E", color: "#EDEDEF", minHeight: "100vh" }}
        >
            {children}
        </div>
    );
}
