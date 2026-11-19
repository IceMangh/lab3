import React, { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { ThemeToggle } from './ThemeToggle';

export function Header({ onHelp, onExport, theme, onThemeChange, power = false }) {
  const [exportOpen, setExportOpen] = useState(false);
  const menu = useRef(null);
  useEffect(() => {
    function close(event) { if (!menu.current?.contains(event.target)) setExportOpen(false); }
    function escape(event) { if (event.key === 'Escape') setExportOpen(false); }
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape); };
  }, []);
  return <header className="header">
    <a className="brand" href="#main" aria-label="GRAPH / LAB — лаборатория графов"><svg viewBox="0 0 44 40" aria-hidden="true"><path d="m5 33 18-28 16 28" fill="none" stroke="currentColor" strokeWidth="2" /><g fill="var(--background)" stroke="currentColor" strokeWidth="2"><circle cx="5" cy="33" r="3.7" /><circle cx="23" cy="5" r="4.7" /><circle cx="39" cy="33" r="3.7" /></g></svg><span>GRAPH <em>/</em> LAB</span></a>
    <nav className="navigation lab-navigation" aria-label="Основная навигация">
      <a className={power ? '' : 'active'} aria-current={power ? undefined : 'page'} href="#main">Лаборатория</a>
      <a className={power ? 'power-nav active' : 'power-nav'} aria-current={power ? 'page' : undefined} href="#power">Электроснабжение</a>
      {onHelp && <button aria-label="Как это работает" onClick={onHelp}><span className="help-label">Как это работает</span><Icon className="help-compact" name="info" /></button>}
    </nav>
    <div className="header-right"><ThemeToggle theme={theme} onChange={onThemeChange} />{onExport && <div className="export-wrap" ref={menu}>
      <button className="button export-button" aria-label="Экспорт" aria-haspopup="true" aria-expanded={exportOpen} onClick={() => setExportOpen(value => !value)}><Icon name="export" size={18} /><span>Экспорт</span></button>
      {exportOpen && <div className="export-menu" aria-label="Формат экспорта">{[['json', 'Граф и результат', 'JSON'], ['csv', 'Таблица данных', 'CSV'], ['svg', 'Изображение графа', 'SVG']].map(([format, label, extension]) => <button key={format} onClick={() => { onExport(format); setExportOpen(false); }}><span>{label}</span><small>{extension}</small></button>)}</div>}
    </div>}</div>
  </header>;
}
