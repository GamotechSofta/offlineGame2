import { createContext } from 'react';
import enTranslations from '../translations/en';
import hiTranslations from '../translations/hi';
import mrTranslations from '../translations/mr';

export const LanguageContext = createContext(null);

export const translations = {
    en: enTranslations,
    hi: hiTranslations,
    mr: mrTranslations,
};
