import React from 'react';
import { Icon } from './Icon';

export function ThemeToggle({ theme, onChange }) {
  return <div className="theme-toggle" role="group" aria-label="Тема оформления">
    {[['light', 'sun', 'Светлая тема'], ['dark', 'moon', 'Тёмная тема']].map(([value, icon, label]) => <button
      key={value} aria-label={label} title={label} aria-pressed={theme === value} onClick={() => onChange(value)}>
      <Icon name={icon} size={20} />
    </button>)}
  </div>;
}
