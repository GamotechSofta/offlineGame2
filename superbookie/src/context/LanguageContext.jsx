import React, { createContext, useContext, useState, useEffect } from 'react';
import enTranslations from '../translations/en';
import hiTranslations from '../translations/hi';
import mrTranslations from '../translations/mr';

const LanguageContext = createContext();

const translations = {
    en: enTranslations,
    hi: hiTranslations,
    mr: mrTranslations,
};

export const LanguageProvider = ({ children }) => {
    const [language, setLanguage] = useState(() => {
        // Get language from localStorage or default to English
        const savedLanguage = localStorage.getItem('bookie_language');
        return savedLanguage && ['en', 'hi', 'mr'].includes(savedLanguage) ? savedLanguage : 'en';
    });

    useEffect(() => {
        // Save language to localStorage whenever it changes
        localStorage.setItem('bookie_language', language);
    }, [language]);

    const t = (key) => {
        return translations[language]?.[key] || translations.en[key] || key;
    };

    const changeLanguage = (lang) => {
        if (['en', 'hi', 'mr'].includes(lang)) {
            setLanguage(lang);
        }
    };

    return (
        <LanguageContext.Provider value={{ language, changeLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
};
