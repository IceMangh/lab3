import { useCallback, useEffect, useState } from 'react';

export function usePlayback(total) {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    if (!playing || step >= total) return;
    const timer = setTimeout(() => {
      setStep(step + 1);
      if (step + 1 === total) setPlaying(false);
    }, 850 / speed);
    return () => clearTimeout(timer);
  }, [playing, speed, total, step]);

  const restart = useCallback((autoplay = false) => {
    setStep(0);
    setPlaying(autoplay);
  }, []);

  function seek(value) {
    setPlaying(false);
    setStep(Math.max(0, Math.min(value, total)));
  }

  function togglePlayback() {
    if (!total) return;
    if (step === total) restart(true);
    else setPlaying(value => !value);
  }

  return { step, playing, speed, total, setStep: seek, setSpeed, restart, togglePlayback };
}
