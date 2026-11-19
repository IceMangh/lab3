import React from 'react';
import { frameMessage } from '../lib/graph';
import { IconButton } from './Icon';

export function Playback({ lab, message }) {
  return <div className="playback-region">
    {lab.result && <div className="step-message" aria-live="polite">{message ?? frameMessage(lab.result, lab.step)}</div>}
    <div className="playback" aria-label="Пошаговый просмотр результата">
      <div className="playback-buttons"><IconButton className="primary" icon={lab.playing ? 'pause' : 'play'} label={lab.playing ? 'Приостановить просмотр' : lab.result?.algorithm === 'components' ? 'Воспроизвести поиск' : 'Воспроизвести результат'} disabled={!lab.total} onClick={lab.togglePlayback} />
        <IconButton icon="back" label="Предыдущий шаг" disabled={!lab.result || lab.step === 0} onClick={() => lab.setStep(Math.max(0, lab.step - 1))} />
        <IconButton icon="next" label="Следующий шаг" disabled={!lab.result || lab.step >= lab.total} onClick={() => lab.setStep(Math.min(lab.total, lab.step + 1))} /></div>
      <input className="progress-range" type="range" aria-label="Шаг визуализации" min="0" max={lab.total || 1} value={lab.step} disabled={!lab.total}
        style={{ '--progress': `${lab.total ? lab.step / lab.total * 100 : 0}%` }} onChange={event => lab.setStep(Number(event.target.value))} />
      <span className="step-counter">Шаг <b>{lab.step}</b> / {lab.total}</span>
      <label className="speed-select"><span className="sr-only">Скорость воспроизведения</span><select aria-label="Скорость воспроизведения" value={lab.speed} onChange={event => lab.setSpeed(Number(event.target.value))}><option value="0.5">0.5×</option><option value="1">1×</option><option value="2">2×</option><option value="4">4×</option></select></label>
    </div>
  </div>;
}
