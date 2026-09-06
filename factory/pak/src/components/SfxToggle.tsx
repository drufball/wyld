import { useState } from 'react';
import { isSfxOn, playSound, setSfxOn } from '../lib/feedback.js';
import { Button } from './ui/button.js';

export function SfxToggle({ className }: { className?: string }) {
  const [on, setOn] = useState(isSfxOn);
  return (
    <Button
      variant="retro"
      type="button"
      className={className}
      aria-pressed={on}
      onClick={() => {
        const next = !on;
        setSfxOn(next);
        setOn(next);
        if (next) playSound('save');
      }}
    >
      Sounds &amp; rumble: {on ? 'on' : 'off'}
    </Button>
  );
}
