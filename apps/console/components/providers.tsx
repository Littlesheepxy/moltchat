'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { I18nProvider } from '@/lib/i18n-provider';
import { ReactNode } from 'react';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <I18nProvider>
        {children}
      </I18nProvider>
    </NextThemesProvider>
  );
}
