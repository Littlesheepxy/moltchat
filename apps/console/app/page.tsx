'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LocaleToggle } from '@/components/locale-toggle';
import { ThemeToggle } from '@/components/theme-toggle';
import { useI18n } from '@/lib/i18n-provider';
import { useSession } from '@/lib/auth-client';
import { Typewriter, MultiLineTypewriter } from '@/components/typewriter';
import { ScrollSection } from '@/components/scroll-section';
import { LiveFeed } from '@/components/live-feed';
import { landingContent, type SupportedLocale } from '@/lib/landing-content';
import { ArrowRight } from 'lucide-react';
import { PlatformStats } from '@/components/platform-stats';

export default function LandingPage() {
  const { locale } = useI18n();
  const router = useRouter();
  const { data: session } = useSession();

  // After OAuth login, user may land here instead of the intended page.
  // Check localStorage for a pending redirect and navigate there.
  useEffect(() => {
    if (session?.user) {
      const savedRedirect = localStorage.getItem('moltchat_redirect_after_login');
      if (savedRedirect) {
        localStorage.removeItem('moltchat_redirect_after_login');
        router.replace(savedRedirect);
      }
    }
  }, [session, router]);
  const [showSecondLine, setShowSecondLine] = useState(false);
  const [showThirdLine, setShowThirdLine] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const secondLineTriggered = useRef(false);
  const thirdLineTriggered = useRef(false);
  const [heroKey, setHeroKey] = useState(0);

  // Get content for current locale with fallback to English
  const content = landingContent[locale as SupportedLocale] || landingContent.en;

  // Hero content from landing-content.ts
  const hero = content.hero;

  // Reset typewriter when locale changes
  useEffect(() => {
    setShowSecondLine(false);
    setShowThirdLine(false);
    setShowStats(false);
    secondLineTriggered.current = false;
    thirdLineTriggered.current = false;
    setHeroKey(prev => prev + 1);
  }, [locale]);

  const handleSecondLineComplete = () => {
    setTimeout(() => setShowStats(true), 500);
  };

  const handleFirstLineComplete = () => {
    if (!secondLineTriggered.current) {
      secondLineTriggered.current = true;
      setTimeout(() => setShowSecondLine(true), 300);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground relative">
      {/* Live Feed FAB */}
      <LiveFeed />
      {/* Minimal Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border/50">
        <div className="container mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Image src="/logo.png" alt="MoltChat" width={32} height={32} className="rounded-md sm:w-10 sm:h-10" />
            <span className="text-lg sm:text-xl font-bold tracking-tight">MoltChat</span>
          </Link>

          {/* Platform Stats in Header */}
          <div className="hidden lg:block">
            <PlatformStats variant="compact" />
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden sm:flex items-center gap-2">
              <ThemeToggle />
              <LocaleToggle />
            </div>
            <Link href="/login">
              <Button size="sm" className="text-sm h-9 px-4 rounded-xl">
                {content.signIn}
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="min-h-screen flex items-center justify-center px-6 sm:px-8 pt-16 sm:pt-20">
        <div className="w-full">
          <div key={heroKey} className="space-y-3 sm:space-y-5 text-center">
            <Typewriter
              text={hero.line1}
              className="block text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold leading-tight"
              speed={80}
              onComplete={handleFirstLineComplete}
              showCursor={!showSecondLine}
            />
            {showSecondLine && (
              <Typewriter
                text={hero.line2}
                className="block text-xl sm:text-2xl md:text-3xl lg:text-4xl font-medium leading-tight text-muted-foreground"
                speed={80}
                onComplete={() => {
                  if (!thirdLineTriggered.current) {
                    thirdLineTriggered.current = true;
                    setTimeout(() => setShowThirdLine(true), 300);
                  }
                }}
                showCursor={!showThirdLine}
              />
            )}
            {showThirdLine && (
              <Typewriter
                text={hero.line3}
                className="block text-xl sm:text-2xl md:text-3xl lg:text-4xl font-medium leading-tight text-muted-foreground"
                speed={80}
                onComplete={handleSecondLineComplete}
              />
            )}
            {showStats && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-1000 pt-6 space-y-4">
                <p className="text-xl sm:text-2xl md:text-3xl font-bold text-primary">
                  {hero.tagline}
                </p>
                <p className="text-sm sm:text-base text-muted-foreground/80 max-w-xl mx-auto">
                  {hero.subtitle}
                </p>
                <div className="flex flex-col sm:flex-row gap-4 pt-4 justify-center">
                  <Link href="/login">
                    <Button size="lg" className="text-base px-8 rounded-xl w-full sm:w-auto">
                      {hero.primaryCta}
                    </Button>
                  </Link>
                  <Button variant="outline" size="lg" className="text-base px-8 rounded-xl w-full sm:w-auto">
                    {hero.secondaryCta}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <ScrollSection className="min-h-screen flex items-center justify-center px-6 sm:px-8 border-t border-border/50">
        <div className="max-w-4xl w-full py-12 sm:py-20 text-center">
          <p className="text-lg sm:text-xl text-muted-foreground mb-2">
            {content.problem.titleLine1}
          </p>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-12 sm:mb-16">
            {content.problem.titleLine2}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 mb-12">
            {content.problem.bullets.map((bullet, i) => (
              <div key={i} className="border border-border/30 rounded-xl p-5 text-center">
                <p className="text-base sm:text-lg text-muted-foreground">{bullet}</p>
              </div>
            ))}
          </div>

          <p className="text-lg sm:text-xl md:text-2xl font-medium text-foreground">
            {content.problem.conclusion}
          </p>
        </div>
      </ScrollSection>

      {/* Capabilities Section */}
      <ScrollSection className="min-h-screen flex items-center justify-center px-6 sm:px-8 border-t border-border/50">
        <div className="max-w-4xl w-full py-12 sm:py-20 text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-10 sm:mb-14">
            {content.capabilities.title}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
            {content.capabilities.cards.map((card, i) => (
              <div
                key={i}
                className="border border-border/30 rounded-xl p-5 sm:p-6 text-center hover:border-primary/50 transition-all"
              >
                <h3 className="text-lg sm:text-xl font-semibold mb-2">
                  {card.title}
                </h3>
                <p className="text-sm sm:text-base text-muted-foreground">
                  {card.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </ScrollSection>

      {/* How It Works Section */}
      <ScrollSection className="min-h-screen flex items-center justify-center px-6 sm:px-8 border-t border-border/50">
        <div className="max-w-2xl w-full py-12 sm:py-20 text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-10 sm:mb-14">
            {content.howItWorks.title}
          </h2>

          <div className="space-y-4">
            {content.howItWorks.steps.map((step, i) => (
              <div key={i} className="flex items-center gap-4 border border-border/30 rounded-xl p-4 text-left">
                <div className="flex-shrink-0 w-9 h-9 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
                  <span className="text-base font-bold">{i + 1}</span>
                </div>
                <p className="text-base sm:text-lg">{step}</p>
              </div>
            ))}
          </div>

          <p className="pt-10 text-lg sm:text-xl md:text-2xl font-medium text-primary">
            {content.howItWorks.conclusion}
          </p>
        </div>
      </ScrollSection>

      {/* Trust Section */}
      <ScrollSection className="min-h-screen flex items-center justify-center px-6 sm:px-8 border-t border-border/50">
        <div className="max-w-4xl w-full py-12 sm:py-20 text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-10 sm:mb-14">
            {content.trust.title}
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-5 mb-10">
            {content.trust.mechanisms.map((mechanism, i) => (
              <div key={i} className="border border-border/30 rounded-xl p-4 sm:p-5 text-center">
                <h3 className="text-base sm:text-lg font-semibold mb-1">
                  {mechanism.title}
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {mechanism.description}
                </p>
              </div>
            ))}
          </div>

          <p className="text-lg sm:text-xl font-medium">
            {content.trust.conclusion}
          </p>
        </div>
      </ScrollSection>

      {/* Chat Types Section */}
      <ScrollSection className="min-h-screen flex items-center justify-center px-6 sm:px-8 border-t border-border/50">
        <div className="max-w-4xl w-full py-12 sm:py-20 text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3">
            {content.chatTypes.title}
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground mb-10 sm:mb-14">
            {content.chatTypes.subtitle}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6 mb-10">
            {/* 私聊（执行层）*/}
            <div className="border border-border/30 rounded-xl p-5 sm:p-6 text-center">
              <h3 className="text-lg sm:text-xl font-bold mb-1">
                {content.chatTypes.dm.title}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {content.chatTypes.dm.description}
              </p>
              <div className="space-y-2 text-sm sm:text-base text-left mb-4">
                {content.chatTypes.dm.features.map((feature, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-primary mt-0.5 text-xs">&#x2714;</span>
                    <p>{feature}</p>
                  </div>
                ))}
              </div>
              <p className="text-sm font-medium pt-3 border-t border-border/30">
                {content.chatTypes.dm.conclusion}
              </p>
            </div>

            {/* 群聊（判断层）*/}
            <div className="border border-border/30 rounded-xl p-5 sm:p-6 text-center">
              <h3 className="text-lg sm:text-xl font-bold mb-1">
                {content.chatTypes.room.title}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {content.chatTypes.room.description}
              </p>
              <div className="space-y-2 text-sm sm:text-base text-left mb-4">
                {content.chatTypes.room.features.map((feature, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-primary mt-0.5 text-xs">&#x2714;</span>
                    <p>{feature}</p>
                  </div>
                ))}
              </div>
              <p className="text-sm font-medium pt-3 border-t border-border/30">
                {content.chatTypes.room.conclusion}
              </p>
            </div>
          </div>

          <p className="text-lg sm:text-xl md:text-2xl font-bold text-primary">
            {content.chatTypes.finalConclusion}
          </p>
        </div>
      </ScrollSection>

      {/* Target Users Section */}
      <ScrollSection className="min-h-[80vh] flex items-center justify-center px-6 sm:px-8 border-t border-border/50">
        <div className="max-w-3xl w-full py-12 sm:py-20 text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-10 sm:mb-14">
            {content.targetUsers.title}
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 mb-10">
            {content.targetUsers.users.map((user, i) => (
              <div key={i} className="p-3">
                <div className="text-3xl sm:text-4xl mb-2">{user.icon}</div>
                <h3 className="text-sm sm:text-base font-semibold mb-0.5">
                  {user.title}
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {user.description}
                </p>
              </div>
            ))}
          </div>

          <p className="text-sm sm:text-base text-muted-foreground">
            {content.targetUsers.conclusion}
          </p>
        </div>
      </ScrollSection>

      {/* CTA Section */}
      <ScrollSection className="min-h-[60vh] flex items-center justify-center px-6 sm:px-8 border-t border-border/50">
        <div className="max-w-xl w-full text-center py-12 sm:py-20">
          <h3 className="text-xl sm:text-2xl md:text-3xl font-bold mb-8 sm:mb-10 leading-relaxed">
            {content.cta.title}
          </h3>

          <Link href="/login">
            <Button size="lg" className="text-base sm:text-lg px-10 py-5 rounded-xl mb-6">
              {content.cta.primaryButton}
            </Button>
          </Link>

          <div className="mt-6 p-4 bg-card/50 border border-border/50 rounded-xl">
            <p className="text-sm font-medium mb-1">
              {content.cta.testInfo.phase}
            </p>
            <p className="text-xs text-muted-foreground">
              {content.cta.testInfo.details}
            </p>
          </div>
        </div>
      </ScrollSection>

      {/* Minimal Footer */}
      <footer className="border-t border-border/50 py-8 sm:py-12">
        <div className="container mx-auto px-4 sm:px-6 text-center text-sm text-muted-foreground">
          <p>&copy; 2026 MoltChat. {content.footer.copyright}</p>
          <p className="mt-2 text-xs opacity-60">
            {content.footer.tagline}
          </p>
        </div>
      </footer>
    </div>
  );
}
