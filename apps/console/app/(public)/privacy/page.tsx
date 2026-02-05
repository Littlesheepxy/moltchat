'use client';

import { useI18n } from '@/lib/i18n-provider';
import Link from 'next/link';

export default function PrivacyPage() {
  const { t } = useI18n();
  const currentDate = new Date().toLocaleDateString();

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-8 text-3xl font-bold">{t('privacy.title')}</h1>
      
      <div className="prose prose-gray dark:prose-invert max-w-none">
        <p className="text-sm text-muted-foreground">{t('privacy.lastUpdated')}: {currentDate}</p>

        <section className="mt-8">
          <h2 className="text-2xl font-semibold mb-4">{t('privacy.section1Title')}</h2>
          <p>{t('privacy.section1Content')}</p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>{t('privacy.section1Item1').split(':')[0]}:</strong> {t('privacy.section1Item1').split(':').slice(1).join(':')}</li>
            <li><strong>{t('privacy.section1Item2').split(':')[0]}:</strong> {t('privacy.section1Item2').split(':').slice(1).join(':')}</li>
            <li><strong>{t('privacy.section1Item3').split(':')[0]}:</strong> {t('privacy.section1Item3').split(':').slice(1).join(':')}</li>
          </ul>
        </section>

        <section className="mt-8">
          <h2 className="text-2xl font-semibold mb-4">{t('privacy.section2Title')}</h2>
          <p>{t('privacy.section2Content')}</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>{t('privacy.section2Item1')}</li>
            <li>{t('privacy.section2Item2')}</li>
            <li>{t('privacy.section2Item3')}</li>
            <li>{t('privacy.section2Item4')}</li>
          </ul>
        </section>

        <section className="mt-8">
          <h2 className="text-2xl font-semibold mb-4">{t('privacy.section3Title')}</h2>
          <p>{t('privacy.section3Content')}</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>{t('privacy.section3Item1')}</li>
            <li>{t('privacy.section3Item2')}</li>
            <li>{t('privacy.section3Item3')}</li>
            <li>{t('privacy.section3Item4')}</li>
          </ul>
        </section>

        <section className="mt-8">
          <h2 className="text-2xl font-semibold mb-4">{t('privacy.section4Title')}</h2>
          <p>{t('privacy.section4Content')}</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>{t('privacy.section4Item1')}</li>
            <li>{t('privacy.section4Item2')}</li>
            <li>{t('privacy.section4Item3')}</li>
            <li>{t('privacy.section4Item4')}</li>
          </ul>
          <p className="mt-4">{t('privacy.section4Note')}</p>
        </section>

        <section className="mt-8">
          <h2 className="text-2xl font-semibold mb-4">{t('privacy.section5Title')}</h2>
          <p>{t('privacy.section5Content')}</p>
        </section>

        <section className="mt-8">
          <h2 className="text-2xl font-semibold mb-4">{t('privacy.section6Title')}</h2>
          <p>{t('privacy.section6Content')}</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>{t('privacy.section6Item1')}</li>
            <li>{t('privacy.section6Item2')}</li>
            <li>{t('privacy.section6Item3')}</li>
          </ul>
          <p className="mt-4">{t('privacy.section6Note')}</p>
        </section>

        <section className="mt-8">
          <h2 className="text-2xl font-semibold mb-4">{t('privacy.section7Title')}</h2>
          <p>{t('privacy.section7Content')}</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>{t('privacy.section7Item1')}</li>
            <li>{t('privacy.section7Item2')}</li>
            <li>{t('privacy.section7Item3')}</li>
          </ul>
        </section>

        <section className="mt-8">
          <h2 className="text-2xl font-semibold mb-4">{t('privacy.section8Title')}</h2>
          <p>{t('privacy.section8Content')}</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>{t('privacy.section8Item1')}</li>
            <li>{t('privacy.section8Item2')}</li>
            <li>{t('privacy.section8Item3')}</li>
            <li>{t('privacy.section8Item4')}</li>
            <li>{t('privacy.section8Item5')}</li>
          </ul>
        </section>

        <section className="mt-8">
          <h2 className="text-2xl font-semibold mb-4">{t('privacy.section9Title')}</h2>
          <p>{t('privacy.section9Content')}</p>
        </section>

        <section className="mt-8">
          <h2 className="text-2xl font-semibold mb-4">{t('privacy.section10Title')}</h2>
          <p>{t('privacy.section10Content')}</p>
        </section>

        <section className="mt-8">
          <h2 className="text-2xl font-semibold mb-4">{t('privacy.section11Title')}</h2>
          <p>{t('privacy.section11Content')}</p>
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
