import React, { useEffect, useRef, useState } from 'react';
import { ALGORITHMS, generateGraph, parseEdgeList, validateGraph } from '../lib/graph';
import { Icon, IconButton } from './Icon';

function Dialog({ title, onClose, children, className = '' }) {
  const panel = useRef(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current.querySelector('button, input, select, textarea')?.focus();
    function keydown(event) {
      if (event.key === 'Escape') { event.preventDefault(); close.current(); }
      if (event.key !== 'Tab') return;
      const focusable = [...panel.current.querySelectorAll('button, input, select, textarea, a[href]')].filter(el => !el.disabled && el.getClientRects().length);
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('keydown', keydown); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  return <div className="dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className={`dialog ${className}`} role="dialog" aria-modal="true" aria-labelledby="dialog-title" ref={panel}>
      <div className="dialog-heading"><h2 id="dialog-title">{title}</h2><IconButton icon="close" label="Закрыть окно" onClick={onClose} /></div>{children}
    </section>
  </div>;
}

export function GraphDialog({ graph, initialCount = 8, initialPreset = 'random', onClose, onCreate }) {
  const [tab, setTab] = useState('generate');
  const [preset, setPreset] = useState(initialPreset);
  const [count, setCount] = useState(initialCount);
  const [density, setDensity] = useState(22);
  const [text, setText] = useState(graph.edges.map(e => `${e.from} ${e.to} ${e.weight}`).join('\n'));
  const [error, setError] = useState('');
  const fileInput = useRef(null);
  function create(event) {
    event.preventDefault();
    const n = Number(count);
    if (count === '' || !Number.isInteger(n) || n < 0 || n > 100) { setError('Введите от 0 до 100 вершин.'); return; }
    try {
      const settings = { directed: graph.directed, weighted: graph.weighted };
      onCreate(tab === 'manual' ? parseEdgeList(text, n, settings) : generateGraph(n, density, preset, settings));
    } catch (error) { setError(error.message); }
  }
  return <Dialog title="Новый граф" onClose={onClose}>
    <div className="dialog-tabs" role="tablist" aria-label="Способ создания графа">{[['generate', 'Генерация'], ['manual', 'Список рёбер']].map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} onClick={() => { setTab(id); setError(''); }}>{label}</button>)}</div>
    <form onSubmit={create}>
      {tab === 'generate' && <div className="preset-options">{[['random', 'Случайный', 'С заданной плотностью'], ['cycle', 'Цикл', 'Последовательные связи'], ['empty', 'Без рёбер', 'Только вершины'], ['disconnected', 'Несвязный', 'До трёх компонент'], ['demo', 'Пример', '8 вершин, 11 рёбер']].map(([id, label, hint]) => <button key={id} type="button" className={preset === id ? 'selected' : ''} aria-pressed={preset === id} onClick={() => { setPreset(id); if (id === 'demo') setCount(8); }}><span>{label}</span><small>{hint}</small>{preset === id && <Icon name="check" size={17} />}</button>)}</div>}
      <label className="field"><span>Количество вершин</span><input aria-label="Количество вершин" type="number" min="0" max="100" value={count} onChange={event => { setCount(event.target.value); if (preset === 'demo') setPreset('random'); }} /></label>
      {tab === 'generate' && preset === 'random' && <label className="field density-field"><span>Дополнительные связи <b>{density}%</b></span><input type="range" min="0" max="75" value={density} onChange={event => setDensity(Number(event.target.value))} /></label>}
      {tab === 'manual' && <label className="field"><span>Откуда · куда · вес</span><textarea aria-label="Список рёбер" value={text} onChange={event => setText(event.target.value)} placeholder={'0 1 4\n1 2 3\n0 2 8'} rows="7" spellCheck="false" /><small>Одно ребро на строку. Нумерация вершин с 0. Вес можно пропустить.</small></label>}
      {error && <p className="error-message" role="alert">{error}</p>}
      <div className="dialog-actions"><input type="file" accept=".json,application/json" className="sr-only" ref={fileInput} aria-label="Импорт графа из JSON" onChange={async event => {
        const file = event.target.files?.[0];
        if (!file) return;
        try { if (file.size > 1_000_000) throw new Error('Файл должен быть меньше 1 МБ.'); const data = JSON.parse(await file.text()); onCreate(validateGraph(data.graph || data)); }
        catch (error) { setError(error instanceof SyntaxError ? 'Не удалось прочитать JSON. Проверьте формат файла.' : error.message); }
        event.target.value = '';
      }} /><button type="button" className="button" onClick={() => fileInput.current.click()}><Icon name="upload" size={16} />Импорт JSON</button><button type="submit" className="button primary"><Icon name="plus" size={17} />Создать граф</button></div>
    </form>
    <p className="dialog-footnote">Текущий граф будет заменён. При необходимости сначала экспортируйте его.</p>
  </Dialog>;
}

export function HelpDialog({ onClose }) {
  return <Dialog title="Управление графом" onClose={onClose} className="help-dialog">
    <ol className="help-steps"><li><span>01</span><div><h3>Доска</h3><p>Перетаскивайте фон или удерживайте пробел, чтобы перемещать доску. Колесо масштабирует граф к курсору. Кнопка в углу показывает граф целиком. Панель параметров можно свернуть, а её ширину — изменить за границу.</p></div></li>
      <li><span>02</span><div><h3>Редактирование</h3><p>Курсор перемещает вершины. «+» добавляет вершину на холст, связь соединяет две выбранные вершины. Нажмите на ребро, чтобы изменить вес. Число вершин нового графа задаётся перед генерацией.</p></div></li>
      <li><span>03</span><div><h3>Результат</h3><p>Для компонент связности показаны реальные шаги DFS: посещение вершин, переходы, возвраты и завершение компонент. В панели отображается стек обхода. Стрелки и ползунок позволяют двигаться вперёд и назад. Для остальных задач пошаговый режим раскрывает готовый результат.</p></div></li></ol>
    <div className="algorithm-reference">{Object.entries(ALGORITHMS).map(([id, item]) => <div key={id}><span>{item.name}</span><code>{item.complexity}</code></div>)}</div>
    <p className="dialog-footnote">BFS считает рёбра, Дейкстра учитывает их вес. При раскраске концы каждой дуги получают разные цвета. Для остова и компонент связности нужен неориентированный граф. Жадная раскраска не гарантирует минимальное число цветов. Для несвязного графа Краскал строит лес.</p>
  </Dialog>;
}
