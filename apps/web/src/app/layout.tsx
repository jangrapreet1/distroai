import type { Metadata, Viewport } from "next";
import { Playfair_Display, Outfit, JetBrains_Mono } from "next/font/google";
import { Toaster } from "react-hot-toast";
import { Providers } from "./providers";
import "./globals.css";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});
const baseFont = Outfit({
  subsets: ["latin"],
  variable: "--font-dm-sans", // Keeping variable name the same for Tailwind compatibility
  display: "swap",
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "DistroAI — Smart Distribution Management",
  description:
    "AI-native SaaS platform for Indian distributors and traders. Manage orders, inventory, invoices, and collections intelligently.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#07070E",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${playfair.variable} ${baseFont.variable} ${jetbrainsMono.variable}`}
    >
      <body className="antialiased">
        <Providers>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: "#1a1625",
                color: "#F0E8D5",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: "10px",
                fontSize: "14px",
              },
              success: {
                iconTheme: { primary: "#2E8B57", secondary: "#F0E8D5" },
              },
              error: {
                iconTheme: { primary: "#E07B60", secondary: "#F0E8D5" },
              },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
