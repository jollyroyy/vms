import React from 'react';

type LogoSize = 'sm' | 'md' | 'lg';

const SIZE_CLASSES: Record<LogoSize, string> = {
  sm: 'h-10 w-10 p-1.5',
  md: 'h-14 w-14 p-2',
  lg: 'h-20 w-20 p-2.5',
};

type Props = {
  size?: LogoSize;
  className?: string;
};

/** Quest Mall brand mark. White badge keeps the logo legible on both dark and gradient
 * surfaces; object-contain + explicit intrinsic size keep it crisp and undistorted. */
export default function Logo({ size = 'md', className = '' }: Props): React.ReactElement {
  return (
    <div
      className={`${SIZE_CLASSES[size]} rounded-2xl bg-white shadow-glow-sm ring-1 ring-brand-300/40 flex items-center justify-center shrink-0 ${className}`}
    >
      <img
        src="/quest-mall-logo.jpg"
        alt="Quest Mall"
        width={193}
        height={160}
        className="h-full w-full object-contain rounded-lg"
        draggable={false}
      />
    </div>
  );
}
