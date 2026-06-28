'use client';

import { useEffect, useRef, useState } from 'react';

type Phase = 'idle' | 'filling' | 'completing';

export function ProgressBar({ active }: { active: boolean }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [width, setWidth] = useState(0);
  const [fading, setFading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const t1Ref = useRef<ReturnType<typeof setTimeout>>(undefined);
  const t2Ref = useRef<ReturnType<typeof setTimeout>>(undefined);
  const activeRef = useRef(false);

  useEffect(() => {
    if (active && !activeRef.current) {
      activeRef.current = true;
      clearTimeout(t1Ref.current);
      clearTimeout(t2Ref.current);
      clearInterval(intervalRef.current);

      setFading(false);
      setPhase('filling');
      setWidth(8);

      intervalRef.current = setInterval(() => {
        setWidth((w) => (w >= 82 ? w : w + (82 - w) * 0.08 + 0.4));
      }, 120);
    } else if (!active && activeRef.current) {
      activeRef.current = false;
      clearInterval(intervalRef.current);

      setPhase('completing');
      setWidth(100);

      t1Ref.current = setTimeout(() => {
        setFading(true);
        t2Ref.current = setTimeout(() => {
          setPhase('idle');
          setWidth(0);
          setFading(false);
        }, 300);
      }, 200);
    }

    return () => clearInterval(intervalRef.current);
  }, [active]);

  if (phase === 'idle') return null;

  return (
    <div
      className="fixed top-0 inset-x-0 z-50 h-[2px] pointer-events-none"
      style={{
        opacity: fading ? 0 : 1,
        transition: fading ? 'opacity 300ms ease' : 'none',
      }}
      aria-hidden="true"
    >
      <div
        className="h-full bg-brand-600"
        style={{
          width: `${width}%`,
          transition:
            phase === 'completing'
              ? 'width 200ms ease-out'
              : width > 8
              ? 'width 120ms linear'
              : 'none',
        }}
      />
    </div>
  );
}
