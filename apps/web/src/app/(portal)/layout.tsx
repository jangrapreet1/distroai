export default function PortalLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-[#050505] text-[#f4f4f5] antialiased">
            {children}
        </div>
    );
}
