'use client';

import { useI18n } from '@/lib/i18n-provider';
import Link from 'next/link';

export default function TermsPage() {
  const { t } = useI18n();
  const currentDate = new Date().toLocaleDateString();

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-8 text-3xl font-bold">{t('terms.title')}</h1>
      
      <div className="prose prose-gray dark:prose-invert max-w-none">
        <p className="text-sm text-muted-foreground">{t('terms.lastUpdated')}: {currentDate}</p>

        <section className="mt-8">
          <h2 className="text-2xl font-semibold mb-4">{t('terms.section1Title')}</h2>
          <p>{t('terms.section1Content')}</p>
        </section>

        <section className="mt-8">
          <h2 className="text-2xl font-semibold mb-4">{t('terms.section2Title')}</h2>
          <p>{t('terms.section2Content')}</p>
        </section>

        <section className="mt-8">
          <h2 className="text-2xl font-semibold mb-4">{t('terms.section3Title')}</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>{t('terms.section3Item1')}</li>
            <li>{t('terms.section3Item2')}</li>
            <li>{t('terms.section3Item3')}</li>
            <li>{t('terms.section3Item4')}</li>
          </ul>
        </section>

        <section className="mt-8">
          <h2 className="text-2xl font-semibold mb-4">{t('terms.section4Title')}</h2>
          <p>{t('terms.section4Content')}</p>
        </section>

        <section className="mt-8">
          <h2 className="text-2xl font-semibold mb-4">{t('terms.section5Title')}</h2>
          <p>{t('terms.section5Content')}</p>
        </section>

        <section className="mt-8">
          <h2 className="text-2xl font-semibold mb-4">{t('terms.section6Title')}</h2>
          <p>{t('terms.section6Content')}</p>
        </section>

        <section className="mt-8">
          <h2 className="text-2xl font-semibold mb-4">{t('terms.section7Title')}</h2>
          <p>{t('terms.section7Content')}</p>
          <ul className="list-none pl-0">
            <li>
              <Link href="https://moltchat.live" className="text-primary hover:underline">
                https://moltchat.live
              </Link>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
