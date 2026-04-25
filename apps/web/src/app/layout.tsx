import type { Metadata, Viewport } from "next";
import { Playfair_Display, Outfit, JetBrains_Mono } from "next/font/google";
import { Toaster } from "react-hot-toast";
import { Providers } from "./providers";
import { ThemeProvider } from "@/contexts/ThemeProvider";
import { FacebookSDK } from "@/components/facebook-sdk";
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
          <ThemeProvider>
            {children}
          </ThemeProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: "var(--tooltip-bg)",
                color: "var(--text-primary)",
                border: "1px solid var(--border)",
                borderRadius: "10px",
                fontSize: "14px",
              },
              success: {
                iconTheme: { primary: "var(--green)", secondary: "var(--text-primary)" },
              },
              error: {
                iconTheme: { primary: "var(--red)", secondary: "var(--text-primary)" },
              },
            }}
          />
        </Providers>
        <FacebookSDK />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').catch(function() {});
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}

