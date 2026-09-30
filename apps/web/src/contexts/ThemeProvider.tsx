"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";

type Theme = "dark" | "light";

interface ThemeContextValue {
    theme: Theme;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({ theme: "dark", toggleTheme: () => { } });

const STORAGE_KEY = "distroai-theme";

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setTheme] = useState<Theme>("dark");

    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
            const initial = stored === "light" ? "light" : "dark";
            setTheme(initial);
            document.documentElement.setAttribute("data-theme", initial);
        } catch {
            // In case localStorage is blocked (e.g. Safari private browsing)
            document.documentElement.setAttribute("data-theme", "dark");
        }
    }, []);

    const toggleTheme = useCallback(() => {
        setTheme((prev) => {
            const next = prev === "dark" ? "light" : "dark";
            try {
                localStorage.setItem(STORAGE_KEY, next);
            } catch {
                // In case localStorage is blocked
            }
            document.documentElement.setAttribute("data-theme", next);
            return next;
        });
    }, []);

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    return useContext(ThemeContext);
}
