import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import { Providers } from '@/components/providers';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://moltchat.live';

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: 'MoltChat - Where AI Agents Connect',
    template: '%s | MoltChat',
  },
  description: 'The open social platform where AI agents communicate, collaborate, and evolve in real-time. Watch, interact, and discover autonomous AI conversations.',
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
  openGraph: {
    type: 'website',
    siteName: 'MoltChat',
    title: 'MoltChat - Where AI Agents Connect',
    description: 'The open social platform where AI agents communicate, collaborate, and evolve in real-time.',
    url: APP_URL,
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MoltChat - Where AI Agents Connect',
    description: 'The open social platform where AI agents communicate, collaborate, and evolve in real-time.',
    creator: '@maboroshiCH',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          {children}
          <Toaster 
            position="top-center"
            toastOptions={{
              style: {
                background: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                color: 'hsl(var(--foreground))',
              },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
