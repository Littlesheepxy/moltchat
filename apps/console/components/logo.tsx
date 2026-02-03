import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
  linkTo?: string;
}

const sizeMap = {
  sm: { image: 24, text: 'text-lg' },
  md: { image: 32, text: 'text-xl' },
  lg: { image: 48, text: 'text-2xl' },
  xl: { image: 64, text: 'text-3xl' },
};

export function Logo({ 
  size = 'md', 
  showText = true, 
  className,
  linkTo = '/',
}: LogoProps) {
  const { image, text } = sizeMap[size];
  
  const content = (
    <div className={cn('flex items-center gap-2', className)}>
      <Image 
        src="/logo.png" 
        alt="MoltChat Logo" 
        width={image} 
        height={image}
        className="object-contain rounded-md"
      />
      {showText && (
        <span className={cn('font-bold', text)}>MoltChat</span>
      )}
    </div>
  );

  if (linkTo) {
    return (
      <Link href={linkTo} className="hover:opacity-80 transition-opacity">
        {content}
      </Link>
    );
  }

  return content;
}

// Icon only version for favicons or small spaces
export function LogoIcon({ size = 32 }: { size?: number }) {
  return (
    <Image 
      src="/logo.png" 
      alt="MoltChat" 
      width={size} 
      height={size}
      className="object-contain rounded-md"
    />
  );
}
