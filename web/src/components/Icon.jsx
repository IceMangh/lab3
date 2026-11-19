import React from 'react';

const paths = {
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5" /></>,
  moon: <path d="M20.5 14.4A8.8 8.8 0 0 1 9.6 3.5a9 9 0 1 0 10.9 10.9Z" fill="currentColor" stroke="none" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  play: <path d="m8 5 11 7-11 7Z" fill="currentColor" stroke="none" />,
  pause: <path d="M8 5v14M16 5v14" strokeWidth="4" />,
  back: <path d="m14 6-6 6 6 6" />,
  next: <path d="m10 6 6 6-6 6" />,
  reset: <><path d="M3 10a9 9 0 0 1 15-6l3 3M21 14a9 9 0 0 1-15 6l-3-3" /><path d="M21 2v5h-5M3 22v-5h5" /></>,
  export: <><path d="M12 16V3m-4 4 4-4 4 4M5 12H3v9h18v-9h-2" /></>,
  upload: <><path d="M12 16V3m-4 4 4-4 4 4M4 16v5h16v-5" /></>,
  cursor: <path d="m5 3 14 11-7 1-3 6Z" />,
  edge: <><path d="m6 18 12-12" /><circle cx="4.5" cy="19.5" r="2.5" /><circle cx="19.5" cy="4.5" r="2.5" /></>,
  trash: <><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" /></>,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  check: <path d="m5 12 4 4L19 6" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7h.01" /></>,
  chevron: <path d="m6 9 6 6 6-6" />,
  fit: <><path d="M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5" /></>,
  hand: <path d="M8 12V6a2 2 0 0 1 4 0v5-7a2 2 0 0 1 4 0v7-5a2 2 0 0 1 4 0v9c0 5-3 7-7 7-3 0-4-2-6-4l-3-4a2 2 0 0 1 3-3l1 1Z" />,
  grid: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18M15 3v18M3 9h18M3 15h18" /></>,
  bolt: <path d="m13 2-9 12h7l-1 8 10-12h-7l1-8Z" />,
  panel: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M15 4v16M18 8v4" /></>,
  expand: <><path d="M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5M3 3l6 6M21 3l-6 6M21 21l-6-6M3 21l6-6" /></>,
  collapse: <path d="M3 9h6V3M15 3v6h6M21 15h-6v6M9 21v-6H3" />,
  arrange: <><circle cx="12" cy="4" r="2" /><circle cx="4" cy="18" r="2" /><circle cx="20" cy="18" r="2" /><path d="M11 6 5 16M13 6l6 10M6 18h12" /></>,
};

export function Icon({ name, size = 20, ...props }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>;
}

export function IconButton({ icon, label, active, className = '', ...props }) {
  return <button className={`icon-button ${active ? 'active' : ''} ${className}`} aria-label={label} title={label}
    {...(active !== undefined ? { 'aria-pressed': active } : {})} {...props}><Icon name={icon} /></button>;
}
