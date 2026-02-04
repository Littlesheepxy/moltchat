'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { type Locale, defaultLocale, locales } from '@/i18n/config';

type Messages = Record<string, any>;

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
  messages: Messages;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

// Detect browser language and map to supported locale
function detectBrowserLocale(): Locale {
  if (typeof window === 'undefined') return defaultLocale;

  // Get browser language (e.g., "zh-CN", "en-US", "ja")
  const browserLang = navigator.language || (navigator as any).userLanguage;
  
  // Extract the primary language code (e.g., "zh" from "zh-CN")
  const primaryLang = browserLang.split('-')[0].toLowerCase();
  
  // Check if we support this language
  if (locales.includes(primaryLang as Locale)) {
    return primaryLang as Locale;
  }
  
  // Fallback to default
  return defaultLocale;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);
  const [messages, setMessages] = useState<Messages>({});
  const [initialized, setInitialized] = useState(false);

  // Initialize locale on mount (check localStorage first, then browser, then default)
  useEffect(() => {
    if (typeof window !== 'undefined' && !initialized) {
      const saved = localStorage.getItem('locale') as Locale;
      
      if (saved && locales.includes(saved)) {
        // Use saved preference
        setLocaleState(saved);
      } else {
        // Detect browser language
        const detected = detectBrowserLocale();
        setLocaleState(detected);
      }
      
      setInitialized(true);
    }
  }, [initialized]);

  // Load messages when locale changes
  useEffect(() => {
    const loadMessages = async () => {
      try {
        const msgs = await import(`@/messages/${locale}.json`);
        setMessages(msgs.default);
      } catch (error) {
        console.error(`Failed to load messages for locale: ${locale}`, error);
      }
    };

    loadMessages();

    // Save to localStorage
    if (typeof window !== 'undefined' && initialized) {
      localStorage.setItem('locale', locale);
    }
  }, [locale, initialized]);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
  };

  const t = (key: string): string => {
    const keys = key.split('.');
    let value: any = messages;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return key; // Return key if translation not found
      }
    }

    return typeof value === 'string' ? value : key;
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, messages }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
}
