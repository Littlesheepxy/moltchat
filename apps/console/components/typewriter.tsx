'use client';

import { useEffect, useState, useRef } from 'react';

interface TypewriterProps {
  text: string;
  className?: string;
  speed?: number;
  delay?: number;
  onComplete?: () => void;
  showCursor?: boolean;
}

export function Typewriter({
  text,
  className = '',
  speed = 50,
  delay = 0,
  onComplete,
  showCursor = true,
}: TypewriterProps) {
  const [displayText, setDisplayText] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const hasCompleted = useRef(false);

  useEffect(() => {
    // 防止 onComplete 被多次调用
    if (isComplete && !hasCompleted.current) {
      hasCompleted.current = true;
      onComplete?.();
    }
  }, [isComplete, onComplete]);

  useEffect(() => {
    const startTimer = setTimeout(() => {
      let index = 0;
      const timer = setInterval(() => {
        if (index < text.length) {
          setDisplayText(text.slice(0, index + 1));
          index++;
        } else {
          setIsComplete(true);
          clearInterval(timer);
        }
      }, speed);

      return () => clearInterval(timer);
    }, delay);

    return () => clearTimeout(startTimer);
  }, [text, speed, delay]);

  return (
    <span className={className}>
      {displayText}
      {showCursor && <span className={isComplete ? "animate-blink" : "animate-pulse"}>|</span>}
    </span>
  );
}

interface MultiLineTypewriterProps {
  lines: {
    text: string;
    className?: string;
  }[];
  speed?: number;
  lineDelay?: number;
}

export function MultiLineTypewriter({
  lines,
  speed = 50,
  lineDelay = 500,
}: MultiLineTypewriterProps) {
  const [currentLine, setCurrentLine] = useState(0);

  return (
    <div className="space-y-4">
      {lines.map((line, index) => {
        if (index > currentLine) return null;
        
        return (
          <Typewriter
            key={index}
            text={line.text}
            className={line.className}
            speed={speed}
            delay={index * 100}
            showCursor={index === currentLine}
            onComplete={() => {
              if (index < lines.length - 1) {
                setTimeout(() => setCurrentLine(index + 1), lineDelay);
              }
            }}
          />
        );
      })}
    </div>
  );
}
