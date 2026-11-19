import React, { useEffect, useRef, useState } from 'react';
import { componentFrame, deleteNode, plural, vertexColor } from '../lib/graph';
import { IconButton } from './Icon';
import { ReactiveGrid } from './ReactiveGrid';
import { useBoardCamera } from '../lib/useBoardCamera';
import { boundCoordinate, MAX_ZOOM, MIN_ZOOM, panFrom, screenToWorld } from '../lib/camera';

const TOOLS = [
  ['select', 'cursor', 'Выбрать и переместить вершину'],
  ['hand', 'hand', 'Переместить доску · H или пробел'],
  ['node', 'plus', 'Добавить вершину: нажмите на холст'],
  ['edge', 'edge', 'Добавить ребро: выберите две вершины'],
  ['delete', 'trash', 'Удалить вершину или ребро'],
];

const HINTS = {
  select: 'Перетаскивайте вершины, чтобы изменить расположение',
  hand: 'Перетаскивайте доску',
  node: 'Нажмите в свободном месте, чтобы добавить вершину',
  edge: 'Выберите начало и конец нового ребра',
  delete: 'Нажмите на вершину или ребро, чтобы удалить',
};

export function GraphCanvas({ lab, svgRef, tool, setTool, nextWeight, viewRevision, gridEnabled, theme, onArrange, presentation }) {
  const { graph, selected, setSelected, updateGraph, result, step } = lab;
  const viewportRef = useRef(null);
  const { camera, setCamera, size, fit, zoomBy } = useBoardCamera(viewportRef, presentation?.fitPoints ?? graph.nodes, viewRevision);
  const [edgeStart, setEdgeStart] = useState(null);
  const [space, setSpace] = useState(false);
  const [panning, setPanning] = useState(false);
  const hovered = useRef(false);
  const drag = useRef(null);
  const suppressClick = useRef(false);
  useEffect(() => { setEdgeStart(null); }, [tool, graph.nodes.length, graph.directed]);
  useEffect(() => { suppressClick.current = false; }, [tool]);
  useEffect(() => {
    function down(event) {
      if (event.defaultPrevented || event.target.closest?.('input, textarea, select, [contenteditable="true"], [role="dialog"]') || event.ctrlKey || event.metaKey || event.altKey) return;
      if (!hovered.current && !viewportRef.current?.contains(document.activeElement)) return;
      if (event.code === 'Space' && !event.target.closest?.('button, a')) { event.preventDefault(); setSpace(true); }
      const shortcuts = { v: 'select', h: 'hand', n: 'node', e: 'edge', x: 'delete' };
      if (shortcuts[event.key.toLowerCase()]) setTool(shortcuts[event.key.toLowerCase()]);
    }
    function up(event) { if (event.code === 'Space') setSpace(false); }
    function blur() { setSpace(false); }
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); };
  }, [setTool]);

  const componentProgress = result?.algorithm === 'components' ? componentFrame(result, step) : null;
  const shownColors = result?.algorithm === 'greedy' ? result.colors.slice(0, step)
    : componentProgress ? componentProgress.assigned.map(group => group === -1 ? undefined : group) : [];
  const path = result?.path.slice(0, step) || [];
  const visited = result && !result.path.length && ['bfs', 'dijkstra'].includes(result.algorithm)
    ? result.order.slice(0, step) : [];
  const tree = result?.algorithm === 'kruskal' ? result.tree.slice(0, step) : [];
  const highlighted = edge => tree.some(e => e.from === edge.from && e.to === edge.to || e.from === edge.to && e.to === edge.from)
    || path.some((id, i) => i > 0 && (path[i - 1] === edge.from && id === edge.to || !graph.directed && path[i - 1] === edge.to && id === edge.from));

  function position(event) {
    const rect = viewportRef.current.getBoundingClientRect();
    return screenToWorld({ x: event.clientX - rect.left, y: event.clientY - rect.top }, camera, size);
  }

  function onNode(id) {
    if (suppressClick.current) { suppressClick.current = false; return; }
    if (tool === 'hand' || space) return;
    if (tool === 'delete') {
      if (id === presentation?.protectedNode) {
        lab.setError(presentation.protectedNodeError);
        return;
      }
      lab.updateGraph(previous => deleteNode(previous, id));
      setSelected(null); return;
    }
    if (tool === 'edge') {
      if (edgeStart === null) { setEdgeStart(id); setSelected({ type: 'node', id }); return; }
      if (edgeStart === id) { setEdgeStart(null); return; }
      if (graph.edges.length >= 5000) { lab.setError('В редакторе можно создать до 5000 рёбер.'); setEdgeStart(null); return; }
      if (graph.edges.some(e => e.from === edgeStart && e.to === id || !graph.directed && e.from === id && e.to === edgeStart)) {
        lab.setError('Эти вершины уже соединены.'); setEdgeStart(null); return;
      }
      const error = presentation?.edgeError?.();
      if (error) { lab.setError(error); setEdgeStart(null); return; }
      updateGraph(previous => ({ ...previous, edges: [...previous.edges, { from: edgeStart, to: id, weight: nextWeight }] }));
      setEdgeStart(null); setSelected(null); return;
    }
    setSelected({ type: 'node', id });
  }

  function onBackground(event) {
    if (suppressClick.current) { suppressClick.current = false; return; }
    if (space || tool === 'hand') return;
    setSelected(null);
    if (tool !== 'node') { setEdgeStart(null); return; }
    if (graph.nodes.length >= 100) { lab.setError('В редакторе можно создать до 100 вершин.'); return; }
    const point = position(event);
    updateGraph(previous => ({ ...previous, nodes: [...previous.nodes, { id: previous.nodes.length,
      x: boundCoordinate(point.x), y: boundCoordinate(point.y) }] }));
  }

  const width = size.width / camera.zoom, height = size.height / camera.zoom;
  return <section className={`graph-area tool-${tool} ${space || panning ? 'is-panning' : ''}`} aria-label="Редактор графа">
    <div className="canvas-title"><h2>{presentation?.title || 'Граф'}</h2><span>{presentation?.summary || <>
      {graph.nodes.length} {plural(graph.nodes.length, ['вершина', 'вершины', 'вершин'])} <b>/</b> {graph.edges.length} {plural(graph.edges.length, ['ребро', 'ребра', 'рёбер'])}
    </>}</span></div>
    <div className="board-viewport" ref={viewportRef} onPointerEnter={() => { hovered.current = true; }} onPointerLeave={() => { hovered.current = false; }}>
    <ReactiveGrid viewportRef={viewportRef} camera={camera} size={size} enabled={gridEnabled} theme={theme} />
    <div className="canvas-tools" role="toolbar" aria-label="Инструменты редактора">
      {TOOLS.map(([id, icon, label]) => <IconButton key={id} icon={icon} label={presentation?.tools?.[id] || label} active={tool === id} onClick={() => setTool(id)} />)}
    </div>
    <svg className="graph-svg" ref={svgRef} viewBox={`${camera.x - width / 2} ${camera.y - height / 2} ${width} ${height}`}
      aria-label="Граф: вершины и связи" role="group" tabIndex="0" onClick={onBackground}
      onDoubleClick={event => { if (!event.target.closest('.graph-node, .graph-edge') && ['select', 'hand'].includes(tool)) fit(); }}
      onPointerDown={event => {
        const forced = event.button === 1 || tool === 'hand' || space;
        if (!forced && (event.button !== 0 || tool !== 'select' || event.target.closest('.graph-node, .graph-edge'))) return;
        event.preventDefault();
        drag.current = { type: 'pan', pointerId: event.pointerId, x: event.clientX, y: event.clientY, camera, moved: false };
        setPanning(true); svgRef.current.setPointerCapture(event.pointerId);
      }}
      onPointerMove={event => {
        if (!drag.current || drag.current.pointerId !== event.pointerId) return;
        if (drag.current.type === 'pan') {
          const delta = { x: event.clientX - drag.current.x, y: event.clientY - drag.current.y };
          if (Math.hypot(delta.x, delta.y) > 3) drag.current.moved = true;
          if (drag.current.moved) setCamera(panFrom(drag.current.camera, delta));
          return;
        }
        const p = position(event);
        if (Math.hypot(p.x - drag.current.x, p.y - drag.current.y) < 2 && !drag.current.moved) return;
        drag.current.moved = true;
        const id = drag.current.id;
        updateGraph(previous => ({ ...previous, nodes: previous.nodes.map(node => node.id === id
          ? { ...node, x: boundCoordinate(p.x - drag.current.offsetX), y: boundCoordinate(p.y - drag.current.offsetY) } : node) }), false);
      }}
      onPointerUp={event => {
        if (!drag.current || drag.current.pointerId !== event.pointerId) return;
        suppressClick.current = drag.current.type === 'node' || drag.current.moved;
        if (svgRef.current.hasPointerCapture(event.pointerId)) svgRef.current.releasePointerCapture(event.pointerId);
        drag.current = null; setPanning(false);
      }} onPointerCancel={() => { drag.current = null; setPanning(false); }} onLostPointerCapture={() => { drag.current = null; setPanning(false); }}>
      <defs>
        <pattern id="export-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="var(--grid-major)" strokeWidth=".6" /></pattern>
        <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="m1 1 7 4-7 4" fill="none" stroke="var(--edge)" strokeWidth="1.4" /></marker>
        <marker id="arrow-active" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="m1 1 7 4-7 4" fill="none" stroke="var(--accent)" strokeWidth="1.4" /></marker>
      </defs>
      <rect className="svg-grid" x={camera.x - width / 2} y={camera.y - height / 2} width={width} height={height} fill="url(#export-grid)" opacity="0" pointerEvents="none" />
      {presentation?.background}
      <g className="graph-edges">
        {graph.edges.map((edge, index) => {
          if (presentation?.showEdge && !presentation.showEdge(index)) return null;
          const a = graph.nodes[edge.from], b = graph.nodes[edge.to];
          const angle = Math.atan2(b.y - a.y, b.x - a.x);
          const loop = edge.from === edge.to;
          const reverse = graph.directed && graph.edges.some(e => e.from === edge.to && e.to === edge.from) && !loop;
          const offset = presentation?.edgeOffsets?.[index] ?? (reverse ? 24 : 0);
          const midX = (a.x + b.x) / 2 - Math.sin(angle) * offset;
          const midY = (a.y + b.y) / 2 + Math.cos(angle) * offset;
          const x1 = a.x + Math.cos(angle) * 25, y1 = a.y + Math.sin(angle) * 25;
          const x2 = b.x - Math.cos(angle) * 29, y2 = b.y - Math.sin(angle) * 29;
          const d = loop ? `M${a.x - 15},${a.y - 24} C${a.x - 70},${a.y - 105} ${a.x + 70},${a.y - 105} ${a.x + 15},${a.y - 24}`
            : `M${x1},${y1} Q${midX},${midY} ${x2},${y2}`;
          const active = presentation?.isEdgeHighlighted?.(index) ?? highlighted(edge);
          const isSelected = selected?.type === 'edge' && selected.id === index;
          const sameEdge = (from, to) => from === edge.from && to === edge.to || from === edge.to && to === edge.from;
          const group = componentProgress?.assigned[edge.from];
          const componentColor = componentProgress && group !== -1
            && (componentProgress.finished.has(group) || componentProgress.edges.some(([from, to]) => sameEdge(from, to)))
            ? vertexColor(group) : null;
          const traversalEdge = componentProgress?.last && componentProgress.last.parent !== -1
            && sameEdge(componentProgress.last.parent, componentProgress.last.vertex);
          const edgeColor = isSelected || active || traversalEdge ? 'var(--accent)' : componentColor || 'var(--edge)';
          const weightWidth = Math.max(30, String(edge.weight).length * 9 + 12);
          const weightPosition = presentation?.weightPositions?.[index] ?? {
            x: loop ? a.x : (a.x + b.x) / 2 - Math.sin(angle) * offset / 2,
            y: loop ? a.y - 77 : (a.y + b.y) / 2 + Math.cos(angle) * offset / 2,
          };
          const selectEdge = () => {
            if (tool === 'delete') { updateGraph(previous => ({ ...previous, edges: previous.edges.filter((_, i) => i !== index) })); setSelected(null); }
            else setSelected({ type: 'edge', id: index });
          };
          return <g key={presentation?.edgeOffsets ? index : `${edge.from}-${edge.to}`} className={`graph-edge ${active ? 'highlighted' : ''} ${isSelected ? 'selected' : ''} ${traversalEdge ? 'traversal-edge' : ''}`}
            tabIndex="0" role="button" aria-label={presentation?.edgeLabel?.(edge) || `Ребро ${edge.from} ${graph.directed ? 'к' : 'и'} ${edge.to}, вес ${graph.weighted ? edge.weight : 1}`}
            onClick={event => {
              event.stopPropagation();
              if (suppressClick.current) { suppressClick.current = false; return; }
              if (tool !== 'hand' && !space) selectEdge();
            }} onKeyDown={event => {
              if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectEdge(); }
            }}>
            <path d={d} fill="none" stroke="transparent" strokeWidth="20" className="edge-hit" />
            {componentColor && theme === 'light' && <path d={d} fill="none" stroke="var(--edge)" strokeWidth="4" opacity=".65" />}
            {presentation?.renderEdge ? presentation.renderEdge({
              d, index, active, selected: isSelected, zoom: camera.zoom,
              start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, control: { x: midX, y: midY },
            }) : <path d={d} fill="none" stroke={edgeColor} strokeWidth={traversalEdge ? 3.2 : active || componentColor ? 2.4 : 1.6}
              markerEnd={graph.directed ? `url(#${active ? 'arrow-active' : 'arrow'})` : undefined} className="edge-line" />}
            {graph.weighted && weightPosition.anchor && <line x1={weightPosition.anchor.x} y1={weightPosition.anchor.y}
              x2={weightPosition.x} y2={weightPosition.y} className="district-price-leader" />}
            {graph.weighted && <g transform={`translate(${weightPosition.x}, ${weightPosition.y})`}>
              <rect x={-weightWidth / 2} y="-12" width={weightWidth} height="24" rx="5" fill="var(--weight-bg)" stroke={componentColor || 'var(--control-border)'} />
              <text textAnchor="middle" dominantBaseline="central" fill="var(--text)" fontSize="16">{edge.weight}</text>
            </g>}
          </g>;
        })}
      </g>
      <g className="graph-nodes">
        {graph.nodes.map(node => {
          const selectedNode = selected?.type === 'node' && selected.id === node.id;
          const color = shownColors[node.id] !== undefined ? vertexColor(shownColors[node.id]) : null;
          const current = componentProgress?.current === node.id;
          const active = path.includes(node.id) || visited.includes(node.id) || tree.some(e => e.from === node.id || e.to === node.id)
            || componentProgress?.stack.includes(node.id);
          const pending = edgeStart === node.id;
          const filled = color || (selectedNode || pending ? 'var(--accent)' : null);
          return <g key={node.id} transform={`translate(${node.x},${node.y})`} className={`graph-node ${current ? 'traversal-current' : ''}`}
            role="button" tabIndex="0" aria-current={current ? 'step' : undefined} aria-label={presentation?.nodeLabel?.(node) || `Вершина ${node.id}${color ? `, ${result.algorithm === 'components' ? 'компонента' : 'цвет'} ${shownColors[node.id] + 1}` : ''}${current ? ', текущая' : ''}`}
            aria-pressed={selectedNode || pending} onClick={event => { event.stopPropagation(); onNode(node.id); }}
            onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onNode(node.id); } }}
            onPointerDown={event => {
              if (tool !== 'select' || space || event.button !== 0) return;
              event.stopPropagation();
              const p = position(event);
              drag.current = { type: 'node', pointerId: event.pointerId, id: node.id, x: p.x, y: p.y, offsetX: p.x - node.x, offsetY: p.y - node.y, moved: false };
              setSelected({ type: 'node', id: node.id });
              svgRef.current.setPointerCapture(event.pointerId);
            }}>
            {presentation?.renderNode ? presentation.renderNode(node, selectedNode || pending) : <>
            {(active || pending) && <circle r="31" fill="none" stroke={color || 'var(--accent)'} strokeOpacity={current ? '.35' : '.12'} strokeWidth="6" />}
            <circle r="24" fill={filled || 'var(--node-bg)'} stroke={current ? 'var(--accent)' : color ? 'var(--semantic-outline)' : active ? 'var(--accent)' : 'var(--node-stroke)'} strokeWidth={current ? '2.8' : '1.7'} />
            <text textAnchor="middle" dominantBaseline="central" fill={color ? '#171717' : filled ? 'var(--on-accent)' : 'var(--text)'} fontSize="20" fontWeight="500">{node.id}</text>
            {lab.mode === 'path' && (node.id === lab.start || node.id === lab.target) && <text y="49" textAnchor="middle" fill="var(--muted)" fontSize="11" letterSpacing="1.2">{node.id === lab.start && node.id === lab.target ? 'СТАРТ / ЦЕЛЬ' : node.id === lab.start ? 'СТАРТ' : 'ЦЕЛЬ'}</text>}
            </>}
          </g>;
        })}
      </g>
    </svg>
    {!graph.nodes.length && <div className="empty-canvas"><h3>Нет вершин</h3><button className="button" onClick={() => setTool('node')}>Добавить вершину</button></div>}
    <div className="canvas-bottom">
      <span className="board-shortcut"><kbd>Space</kbd> перемещение <span>·</span> колесо — масштаб</span>
      <div className="board-view-controls"><IconButton icon="arrange" label="Упорядочить вершины" onClick={onArrange} /><div className="zoom-controls"><IconButton icon="minus" label="Уменьшить граф" disabled={camera.zoom <= MIN_ZOOM} onClick={() => zoomBy(1 / 1.2)} /><button onClick={() => setCamera(previous => ({ ...previous, zoom: 1 }))} title="Масштаб 100 %">{Math.round(camera.zoom * 100)} %</button><IconButton icon="plus" label="Увеличить граф" disabled={camera.zoom >= MAX_ZOOM} onClick={() => zoomBy(1.2)} /></div><IconButton icon="fit" label="Показать граф целиком" onClick={fit} /></div>
    </div>
    {tool !== 'select' && <p className="tool-hint" aria-live="polite">{edgeStart !== null
      ? `Начало: ${presentation?.nodeName?.(graph.nodes[edgeStart]) ?? edgeStart}. Выберите вторую вершину.`
      : presentation?.hints?.[tool] || HINTS[tool]}</p>}
    </div>
  </section>;
}
