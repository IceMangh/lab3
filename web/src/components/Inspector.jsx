import React from 'react';
import { ALGORITHMS, MODES, componentFrame, plural, vertexColor } from '../lib/graph';
import { Icon } from './Icon';

function Toggle({ label, checked, onChange }) {
  return <label className="toggle-row"><span>{label}</span><input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} /><span className="toggle-track" aria-hidden="true"><span /></span></label>;
}

function Results({ lab }) {
  const { result, graph, target, step, total } = lab;
  if (!result) return null;
  const isPath = ['bfs', 'dijkstra'].includes(result.algorithm);
  const distance = result.distances[target];
  const progress = result.algorithm === 'components' ? componentFrame(result, step) : null;
  return <div className="result" aria-live="polite">
    <div className="result-topline"><span className="result-label"><i />Результат</span><span>{result.elapsedMs < 0.001 ? '< 0.001' : result.elapsedMs.toFixed(3)} мс</span></div>
    {result.algorithm === 'greedy' && <><div className="result-value">{result.colorCount}<span>{plural(result.colorCount, ['цвет', 'цвета', 'цветов'])}</span></div>
      <div className="color-legend">{Array.from({ length: result.colorCount }, (_, index) => <span key={index}><i style={{ background: vertexColor(index) }} />{index + 1}</span>)}</div>
      <p>Корректная жадная раскраска.<br />Минимум цветов не гарантируется.</p></>}
    {isPath && <><div className="result-value">{distance === -1 ? '∞' : distance}<span>{distance === -1 ? 'нет пути' : result.algorithm === 'bfs' || !graph.weighted ? plural(distance, ['ребро', 'ребра', 'рёбер']) : 'вес пути'}</span></div>
      <p className="route-text">{result.path.length ? result.path.join(' → ') : 'Цель недостижима из выбранного старта.'}</p>
      <details className="distances"><summary>Расстояния до всех вершин <Icon name="chevron" size={14} /></summary><div className="distance-list">{result.distances.map((distance, id) => <div key={id}><span>Вершина {id}</span><b>{distance === -1 ? '∞' : distance}</b></div>)}</div></details></>}
    {result.algorithm === 'kruskal' && <><div className="result-value">{result.totalWeight}<span>вес {result.componentCount > 1 ? 'леса' : 'остова'}</span></div>
      <p>{result.tree.length} {plural(result.tree.length, ['ребро', 'ребра', 'рёбер'])} · {result.componentCount} {plural(result.componentCount, ['компонента', 'компоненты', 'компонент'])}</p>
      {result.componentCount > 1 && <p className="result-note">Граф несвязный. Построен минимальный остовный лес.</p>}
      {!graph.nodes.length && <p>Граф пуст — добавьте вершины.</p>}</>}
    {progress && <><div className="result-value">{progress.groups.length}<span>{plural(progress.groups.length, ['компонента', 'компоненты', 'компонент'])}</span></div>
      <p>{!graph.nodes.length ? 'Граф пуст.' : step < total ? `Посещено ${progress.visited} из ${graph.nodes.length} вершин.`
        : result.componentCount === 1 ? 'Граф связный.' : 'Граф несвязный. Изолированные вершины — отдельные компоненты.'}</p>
      <div className="dfs-stack" aria-label="Стек DFS"><span>Стек DFS</span><div>{progress.stack.length
        ? progress.stack.map(vertex => <b key={vertex}>{vertex}</b>) : <em>пуст</em>}</div></div>
      <ol className="components-list" aria-label="Найденные компоненты">{progress.groups.map((vertices, index) => <li key={index} className={`revealed ${progress.finished.has(index) ? 'finished' : ''}`}>
        <span className="component-marker" style={{ background: vertexColor(index) }} />
        <div><div className="component-heading"><span>Компонента {index + 1}</span><small>{progress.finished.has(index) ? 'завершена' : 'поиск'}</small></div><p>{vertices.join(', ')}</p></div>
      </li>)}</ol></>}
    <div className="result-progress">{step === total ? <><Icon name="check" size={14} />Просмотр завершён</> : `Просмотр результата: ${step} / ${total}`}</div>
  </div>;
}

export function Inspector({ lab, onGenerate, generationCount, setGenerationCount, nextWeight, setNextWeight }) {
  const { graph, mode, algorithm, selected } = lab;
  const edge = selected?.type === 'edge' ? graph.edges[selected.id] : null;
  const incompatible = graph.directed && (mode === 'tree' || mode === 'components');
  const modeAlgorithm = MODES.find(item => item.id === mode).algorithm;
  return <aside className="inspector" aria-label="Параметры алгоритма">
    <h2>Параметры</h2>
    <label className="field"><span>Алгоритм</span><div className="select-wrap"><select aria-label="Алгоритм" value={algorithm} onChange={event => lab.setAlgorithm(event.target.value)}>
      {Object.entries(ALGORITHMS).filter(([id]) => mode === 'path' ? ['bfs', 'dijkstra'].includes(id) : id === modeAlgorithm)
        .map(([id, item]) => <option key={id} value={id}>{item.name}</option>)}
    </select><Icon name="chevron" size={18} /></div></label>
    <p className="algorithm-description">{ALGORITHMS[algorithm].description}</p>
    {mode === 'path' && <div className="path-fields">{[['Старт', lab.start, lab.setStart], ['Цель', lab.target, lab.setTarget]].map(([label, value, setter]) => <label className="field" key={label}><span>{label}</span><div className="select-wrap"><select aria-label={label} value={value} disabled={!graph.nodes.length} onChange={event => setter(Number(event.target.value))}>
      {!graph.nodes.length && <option value="0">—</option>}{graph.nodes.map(n => <option key={n.id} value={n.id}>Вершина {n.id}</option>)}</select><Icon name="chevron" size={16} /></div></label>)}</div>}
    <div className="graph-settings"><Toggle label="Ориентированный" checked={graph.directed} onChange={directed => {
      lab.setSelected(null);
      lab.updateGraph(previous => {
        const seen = new Set();
        return { ...previous, directed, edges: directed ? previous.edges : previous.edges.filter(edge => {
          const key = [edge.from, edge.to].sort((a, b) => a - b).join(':');
          if (seen.has(key)) return false;
          seen.add(key); return true;
        }) };
      });
    }} /><Toggle label="Взвешенный" checked={graph.weighted} onChange={weighted => lab.updateGraph(previous => ({ ...previous, weighted }))} /></div>
    {incompatible && <p className="inline-warning">Для этой задачи отключите направление рёбер.</p>}
    <form className="generator-block" onSubmit={event => { event.preventDefault(); onGenerate(); }}>
      <label className="field generation-count"><span>Количество вершин <small>0–100</small></span><input aria-label="Количество вершин для генерации" type="number" inputMode="numeric" min="0" max="100" step="1" value={generationCount} onChange={event => setGenerationCount(event.target.value)} /></label>
      <button className="button generate-button" type="submit"><Icon name="reset" />Сгенерировать граф</button>
    </form>
    <button className="button primary run-button" onClick={lab.run} disabled={lab.busy || incompatible}><Icon name="play" />{lab.busy ? 'Вычисляем…' : 'Запустить алгоритм'}</button>
    {lab.error && <div className="error-message" role="alert"><Icon name="info" size={17} /><span>{lab.error}</span></div>}
    <Results lab={lab} />
    {selected && <div className="selection-details"><div className="selection-title"><span>{edge ? `Ребро ${edge.from} ${graph.directed ? '→' : '—'} ${edge.to}` : `Вершина ${selected.id}`}</span><button className="text-button" onClick={() => lab.setSelected(null)}>Снять выбор</button></div>
      {edge && graph.weighted && <label className="field"><span>Вес ребра</span><input aria-label="Вес выбранного ребра" type="number" min="-10000" max="10000" step="1" key={`${selected.id}-${edge.weight}`} defaultValue={edge.weight}
        onBlur={event => { const weight = Number(event.target.value); if (event.target.value.trim() && Number.isInteger(weight) && Math.abs(weight) <= 10000) { if (weight !== edge.weight) lab.updateGraph(previous => ({ ...previous, edges: previous.edges.map((e, i) => i === selected.id ? { ...e, weight } : e) })); } else { event.target.value = edge.weight; lab.setError('Вес — целое число от −10000 до 10000.'); } }}
        onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} /></label>}
      {mode === 'path' && selected.type === 'node' && <div className="selection-actions"><button className="button small" onClick={() => lab.setStart(selected.id)}>Сделать стартом</button><button className="button small" onClick={() => lab.setTarget(selected.id)}>Сделать целью</button></div>}
      <button className="text-button delete-button" onClick={lab.removeSelected}><Icon name="trash" size={14} />Удалить {edge ? 'ребро' : 'вершину'}</button>
    </div>}
    {!selected && graph.weighted && <label className="field next-weight"><span>Вес нового ребра</span><input aria-label="Вес нового ребра" type="number" min="-10000" max="10000" step="1" defaultValue={nextWeight} onChange={event => {
      const weight = Number(event.target.value); if (event.target.value.trim() && Number.isInteger(weight) && Math.abs(weight) <= 10000) setNextWeight(weight);
    }} onBlur={event => {
      const weight = Number(event.target.value);
      if (!event.target.value.trim() || !Number.isInteger(weight) || Math.abs(weight) > 10000) { event.target.value = nextWeight; lab.setError('Вес — целое число от −10000 до 10000.'); }
    }} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} /></label>}
  </aside>;
}
