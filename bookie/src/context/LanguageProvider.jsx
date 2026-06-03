import React, { useState, useEffect } from 'react';
import { LanguageContext, translations } from './i18nContext';

export const LanguageProvider = ({ children }) => {
    const [language, setLanguage] = useState(() => {
        const savedLanguage = localStorage.getItem('bookie_language');
        return savedLanguage && ['en', 'hi', 'mr'].includes(savedLanguage) ? savedLanguage : 'en';
    });

    useEffect(() => {
        localStorage.setItem('bookie_language', language);
    }, [language]);

    const t = (key) => translations[language]?.[key] || translations.en[key] || key;

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
