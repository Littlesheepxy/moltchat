'use client';

import { useState, useCallback, useMemo } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n-provider';
import { MessageSquare, Mail, Rocket, ChevronRight, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================
// Storage key
// ============================================

const STORAGE_KEY = 'moltchat_chat_onboarded';

export function hasCompletedOnboarding(): boolean {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem(STORAGE_KEY) === 'true';
}

function markOnboardingComplete(): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, 'true');
  }
}

// ============================================
// Component
// ============================================

interface WelcomeOnboardingProps {
  open: boolean;
  onClose: () => void;
}

export function WelcomeOnboarding({ open, onClose }: WelcomeOnboardingProps) {
  const { t } = useI18n();
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = useMemo(() => [
    {
      icon: MessageSquare,
      title: t('onboarding.slide1Title'),
      lines: [
        t('onboarding.slide1Line1'),
        t('onboarding.slide1Line2'),
        t('onboarding.slide1Line3'),
      ],
    },
    {
      icon: Mail,
      title: t('onboarding.slide2Title'),
      lines: [
        t('onboarding.slide2Line1'),
        t('onboarding.slide2Line2'),
        t('onboarding.slide2Line3'),
      ],
    },
    {
      icon: Rocket,
      title: t('onboarding.slide3Title'),
      lines: [
        t('onboarding.slide3Line1'),
        t('onboarding.slide3Line2'),
        t('onboarding.slide3Line3'),
      ],
    },
  ], [t]);

  const handleNext = useCallback(() => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(prev => prev + 1);
    } else {
      markOnboardingComplete();
      onClose();
    }
  }, [currentSlide, slides.length, onClose]);

  const handlePrev = useCallback(() => {
    if (currentSlide > 0) {
      setCurrentSlide(prev => prev - 1);
    }
  }, [currentSlide]);

  const handleSkip = useCallback(() => {
    markOnboardingComplete();
    onClose();
  }, [onClose]);

  const slide = slides[currentSlide];
  const Icon = slide.icon;
  const isLast = currentSlide === slides.length - 1;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleSkip(); }}>
      <DialogContent className="sm:max-w-md p-0 gap-0 rounded-2xl overflow-hidden border-0 [&>button]:hidden">
        {/* Top colored area */}
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent pt-10 pb-8 px-6 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
            <Icon className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-xl font-bold">{slide.title}</h2>
        </div>

        {/* Content area */}
        <div className="px-6 pt-5 pb-4 space-y-3">
          {slide.lines.map((line, i) => (
            <p key={i} className="text-sm text-muted-foreground leading-relaxed">
              {line}
            </p>
          ))}
        </div>

        {/* Bottom: dots + buttons */}
        <div className="px-6 pb-6 pt-2 flex items-center justify-between">
          {/* Dots */}
          <div className="flex items-center gap-1.5">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentSlide(i)}
                className={cn(
                  'rounded-full transition-all duration-300',
                  i === currentSlide
                    ? 'w-6 h-2 bg-primary'
                    : 'w-2 h-2 bg-muted-foreground/20 hover:bg-muted-foreground/40'
                )}
              />
            ))}
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-2">
            {currentSlide > 0 && (
              <Button variant="ghost" size="sm" onClick={handlePrev} className="rounded-xl h-9 px-3">
                <ChevronLeft className="h-4 w-4 mr-1" />
                {t('onboarding.back')}
              </Button>
            )}
            {!isLast && (
              <Button variant="ghost" size="sm" onClick={handleSkip} className="rounded-xl h-9 px-3 text-muted-foreground">
                {t('onboarding.skip')}
              </Button>
            )}
            <Button size="sm" onClick={handleNext} className="rounded-xl h-9 px-4">
              {isLast ? t('onboarding.start') : t('onboarding.next')}
              {!isLast && <ChevronRight className="h-4 w-4 ml-1" />}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
