"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useOrgSettings, useUpdateOrgSettings } from '@/hooks/api-hooks';
import { getTranslation } from '@/lib/translations';

type LanguageContextType = {
    language: string;
    setLanguage: (lang: string) => void;
    t: (key: any) => string;
};

const LanguageContext = createContext<LanguageContextType>({
    language: 'en',
    setLanguage: () => { },
    t: (key) => getTranslation('en', key),
});

export function LanguageProvider({ children }: { children: ReactNode }) {
    const { data: settingsData } = useOrgSettings();
    const updateSettings = useUpdateOrgSettings();
    const [language, setLanguageState] = useState('en');

    // Sync from server settings initially
    useEffect(() => {
        const settings = settingsData?.data ?? settingsData;
        if (settings?.language && settings.language !== language) {
            setLanguageState(settings.language);
        }
    }, [settingsData]);

    const setLanguage = (newLang: string) => {
        setLanguageState(newLang);
        // Persist to org settings via API
        updateSettings.mutate({ language: newLang });
    };

    const t = (key: any) => getTranslation(language, key);

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    return useContext(LanguageContext);
}
