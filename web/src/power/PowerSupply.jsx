import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GraphCanvas } from '../components/GraphCanvas';
import { Header } from '../components/Header';
import { Playback } from '../components/Playback';
import { usePlayback } from '../lib/usePlayback';
import { Icon, IconButton } from '../components/Icon';
import { PanelResizer, WorkspaceViewActions, useWorkspaceView } from '../components/WorkspaceView';
import { plural } from '../lib/graph';
import { DistrictCable } from './DistrictCable';
import { DistrictNode } from './DistrictNode';
import { DistrictStreets } from './DistrictStreets';
import { MAX_CABLES, MAX_COST, MAX_HOUSES, cableLabelPositions, cableOffsets, exampleDistrict, generateDistrict,
  makeCityDistrict, nextHouseName, powerFrame, powerSteps, readCost } from './district';
import './power.css';

const units = new Intl.NumberFormat('ru-RU');
const milliseconds = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 3 });

function ObjectOptions({ names }) {
  return names.map((name, index) => <option key={index} value={index}>{name || (index || 'S')}</option>);
}

function stepMessage(current, edges, names, finished) {
  if (!current) return finished ? 'Допустимых кабелей нет. Расчёт завершён.' : 'Начинаем с самых дешёвых кабелей.';
  const edge = edges[current.index];
  const action = current.accepted ? 'Добавляем кабель' : 'Пропускаем кабель';
  const reason = current.accepted ? 'соединяет разные компоненты' : 'образует цикл';
  return `${action} ${names[edge.from]} — ${names[edge.to]} за ${units.format(edge.weight)} у. е. Он ${reason}.${finished ? ' Расчёт завершён.' : ''}`;
}

function PlanResult({ result, frame, finished, names, edges }) {
  if (!result) return null;
  const { feasible, unreachable, elapsedMs } = result;
  const duration = elapsedMs < .001 ? '< 0,001' : milliseconds.format(elapsedMs);
  const state = finished ? (feasible ? 'solved' : 'blocked') : '';
  return <section className={`power-panel power-result ${state}`}>
    <h2>{finished ? 'Результат' : 'Построение остова'}</h2>
    <div className="power-totals">
      <div><span>{finished && feasible ? 'Минимальная стоимость' : 'Стоимость выбранных кабелей'}</span>
        <strong>{units.format(frame.cost)}</strong><span>у. е.</span></div>
      <dl><div><dt>Кабели</dt><dd>{frame.chosen.size}</dd></div>
        <div><dt>Дома с питанием</dt><dd>{frame.powered.size - 1} / {names.length - 1}</dd></div>
        <div><dt>Краскал</dt><dd>{duration} мс</dd></div></dl>
    </div>
    {finished && !feasible && <p>Подключить все дома невозможно. От подстанции нет пути к домам {unreachable.map(index => names[index]).join(', ')}.</p>}
    {frame.chosen.size > 0 && <ul className="power-chosen-list" aria-label="Выбранные кабели">
      {Array.from(frame.chosen, index => {
        const { from, to, weight } = edges[index];
        return <li key={index}><span>{names[from]} — {names[to]}</span><b>{units.format(weight)} у. е.</b></li>;
      })}
    </ul>}
  </section>;
}

export function PowerSupply({ theme, setTheme }) {
  const [graph, setGraph] = useState(exampleDistrict);
  const { nodes, edges } = graph;
  const names = nodes.map(node => node.name);
  const view = useWorkspaceView();
  const svgRef = useRef(null);
  const [tool, setTool] = useState('select');
  const [houseCount, setHouseCount] = useState('3');
  const [from, setFrom] = useState(0);
  const [to, setTo] = useState(1);
  const [cost, setCost] = useState('1');
  const [result, setResult] = useState(null);
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [selected, setSelected] = useState(null);
  const [layoutVersion, setLayoutVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(null);
  const playbackRef = useRef(null);
  const playback = usePlayback(result?.steps.length || 0);
  const finished = !!result && playback.step === playback.total;
  useEffect(() => () => pending.current?.abort(), []);
  useEffect(() => {
    if (result && window.matchMedia('(max-width: 680px)').matches) playbackRef.current?.scrollIntoView({ block: 'nearest' });
  }, [result]);
  const frame = useMemo(() => powerFrame(result?.steps || [], playback.step, edges, nodes.length),
    [result, playback.step, edges, nodes.length]);
  const { chosen, current } = frame;
  const unreachable = new Set(finished ? result.unreachable : []);
  const nameOf = node => node?.name.trim() || (node?.id ? String(node.id) : 'S');
  const offsets = useMemo(() => cableOffsets(edges), [edges]);
  const weightPositions = useMemo(() => cableLabelPositions(nodes, edges, offsets), [nodes, edges, offsets]);
  const presentation = {
    title: 'Район',
    fitPoints: [...nodes, ...graph.city.bounds],
    summary: <>{nodes.length - 1} {plural(nodes.length - 1, ['дом', 'дома', 'домов'])} <b>/</b> {edges.length} {plural(edges.length, ['кабель', 'кабеля', 'кабелей'])}</>,
    tools: {
      select: 'Выбрать и переместить дом или подстанцию',
      node: 'Добавить дом: нажмите на холст',
      edge: 'Добавить кабель: выберите два объекта',
      delete: 'Удалить дом или кабель',
    },
    hints: {
      node: 'Нажмите в свободном месте, чтобы добавить дом',
      edge: 'Выберите два объекта для прокладки кабеля',
      delete: 'Нажмите на дом или кабель, чтобы удалить',
    },
    protectedNode: 0,
    protectedNodeError: 'Подстанцию нельзя удалить.',
    nodeName: nameOf,
    nodeLabel: node => `${node.id ? 'Дом' : 'Подстанция'} ${nameOf(node)}${unreachable.has(node.id) ? ', недоступен' : ''}`,
    edgeLabel: edge => `Кабель ${nameOf(nodes[edge.from])} — ${nameOf(nodes[edge.to])}, стоимость ${edge.weight}`,
    edgeOffsets: offsets,
    weightPositions,
    showEdge: index => !selectedOnly || chosen.has(index),
    isEdgeHighlighted: index => chosen.has(index),
    renderNode: node => <DistrictNode node={node} energized={!!result && frame.powered.has(node.id)} unreachable={unreachable.has(node.id)} />,
    background: graph.city && <DistrictStreets city={graph.city} />,
    renderEdge: geometry => <DistrictCable {...geometry}
      decision={current?.index === geometry.index ? (current.accepted ? 'added' : 'skipped') : undefined} />,
    edgeError() {
      try { readCost(cost); }
      catch (problem) { return problem.message; }
    },
  };

  function edit(next) {
    pending.current?.abort();
    setBusy(false);
    setGraph(next);
    setResult(null);
    playback.restart();
    setSelectedOnly(false);
    setError('');
  }

  function updateGraph(update, invalidate = true) {
    if (!invalidate) {
      setGraph(update);
      return;
    }
    const next = update(graph);
    if (next.nodes.length !== nodes.length) {
      const used = new Set(next.nodes.filter(node => node.name !== undefined).map(node => node.name.trim()));
      next.nodes = next.nodes.map(node => {
        if (node.name !== undefined) return node;
        const name = nextHouseName(node.id, used);
        used.add(name);
        return { ...node, name };
      });
      setHouseCount(String(next.nodes.length - 1));
      setSelected(null);
      setFrom(0);
      setTo(next.nodes.length > 1 ? 1 : 0);
    }
    edit(next);
  }

  function replace(district) {
    edit(district);
    setLayoutVersion(version => version + 1);
    setFrom(0);
    setTo(district.nodes.length > 1 ? 1 : 0);
    setCost('1');
    setSelected(null);
    setTool('select');
    setHouseCount(String(district.nodes.length - 1));
  }

  function changeSize(generate) {
    const count = Number(houseCount);
    if (!/^\d+$/.test(houseCount) || count > MAX_HOUSES) {
      setError(`Введите целое количество домов от 0 до ${MAX_HOUSES}.`);
      return;
    }
    if (generate) {
      replace(generateDistrict(count));
    } else {
      const nextNames = names.slice(0, count + 1);
      const used = new Set(nextNames.map(name => name.trim()));
      while (nextNames.length <= count) {
        const name = nextHouseName(nextNames.length, used);
        nextNames.push(name);
        used.add(name);
      }
      replace(makeCityDistrict(nextNames, edges.filter(edge => edge.from <= count && edge.to <= count), graph.city.seed));
    }
  }

  function addCable(event) {
    event.preventDefault();
    try {
      if (from === to) throw new Error('Выберите два разных объекта.');
      if (edges.length >= MAX_CABLES) throw new Error(`Допустимо до ${MAX_CABLES} соединений.`);
      edit({ ...graph, edges: [...edges, { from, to, weight: readCost(cost) }] });
    } catch (problem) {
      setError(problem.message);
    }
  }

  async function calculate() {
    try {
      const labels = names.map(name => name.trim());
      if (labels.some(label => !label) || new Set(labels).size !== labels.length) {
        throw new Error('Задайте каждому дому и подстанции уникальное непустое название.');
      }
      if (!/^\d+$/.test(houseCount) || Number(houseCount) !== names.length - 1) {
        throw new Error('Сначала примените новое количество домов или сгенерируйте район.');
      }
      const payload = {
        algorithm: 'power', vertexCount: names.length,
        edges: edges.map(edge => ({ ...edge, weight: readCost(edge.weight) })),
      };
      pending.current?.abort();
      const controller = new AbortController();
      pending.current = controller;
      setError('');
      setBusy(true);
      setResult(null);
      playback.restart();
      setSelectedOnly(false);
      setSelected(null);
      try {
        const response = await fetch('/api/solve', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload), signal: controller.signal,
        });
        const plan = await response.json();
        if (!response.ok) {
          if (plan.error === 'Неизвестный алгоритм.') {
            throw new Error('На этом порту запущена старая версия сервера. Перезапустите её через ./run.sh.');
          }
          throw new Error(plan.error || 'Не удалось рассчитать сеть.');
        }
        if (!controller.signal.aborted) {
          const forest = plan.feasible ? plan.tree : plan.forest;
          if (!Array.isArray(forest)) throw new Error('Для пошагового расчёта перезапустите сервер через ./run.sh.');
          const steps = powerSteps(edges, forest);
          setResult({ ...plan, steps });
          playback.restart(steps.length > 0);
        }
      } catch (problem) {
        if (!controller.signal.aborted) {
          setError(problem instanceof TypeError ? 'Нет связи с сервером. Запустите ./run.sh.' : problem.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          pending.current = null;
          setBusy(false);
        }
      }
    } catch (problem) {
      setError(problem.message);
    }
  }

  return <div className="app-shell power-shell">
    <Header power theme={theme} onThemeChange={setTheme} />
    <main id="power">
      <section className={`${view.className} power-workspace`} style={view.style} aria-labelledby="power-heading">
        <div className="workspace-toolbar">
          <h1 id="power-heading">Электроснабжение района</h1>
          <div className="workspace-actions">
            <div className="power-view" role="group" aria-label="Показать соединения">
              <button type="button" aria-pressed={!selectedOnly} onClick={() => setSelectedOnly(false)}>Все связи</button>
              <button type="button" aria-pressed={selectedOnly} disabled={!result} onClick={() => setSelectedOnly(true)}>Выбранные</button>
            </div>
            <WorkspaceViewActions view={view} />
          </div>
        </div>
        <div className="workspace-body">
          <div className="power-board">
            <GraphCanvas lab={{ graph, selected, setSelected, updateGraph, setError }} svgRef={svgRef}
              tool={tool} setTool={setTool} nextWeight={Number(cost)} viewRevision={layoutVersion}
              gridEnabled={view.gridEnabled} theme={theme} presentation={presentation}
              onArrange={() => {
                setGraph(previous => makeCityDistrict(previous.nodes.map(node => node.name), previous.edges, previous.city.seed));
                setLayoutVersion(version => version + 1);
              }} />
            {result && <div ref={playbackRef}>
              <Playback lab={{ ...playback, result }} message={stepMessage(current, edges, names, finished)} />
            </div>}
          </div>
          {view.inspectorOpen && <><PanelResizer view={view} />
            <aside className="inspector power-inspector" aria-label="Настройки электроснабжения">
              <section className="power-panel">
                <h2>Параметры</h2>
                <div className="power-settings">
                  <label htmlFor="power-house-count">Дома</label>
                  <input className="power-control" id="power-house-count" type="number" min="0" max={MAX_HOUSES} step="1"
                    value={houseCount} onChange={event => setHouseCount(event.target.value)} />
                  <button className="button" type="button" onClick={() => changeSize(true)}>Сгенерировать</button>
                  <button className="button" type="button" onClick={() => replace(exampleDistrict())}>Пример</button>
                </div>
                {houseCount !== String(names.length - 1) && <button className="text-button power-apply" type="button" onClick={() => changeSize(false)}>
                  <Icon name="check" size={15} />Применить количество домов
                </button>}
              </section>
              <section className="power-panel">
                <h2>Объекты</h2>
                <div className="power-objects">
                  {names.map((name, index) => <label key={index} className={selected?.type === 'node' && selected.id === index ? 'active' : ''}>
                    <span>{index === 0 ? 'Подстанция' : `Дом ${index}`}</span>
                    <input className="power-control" aria-label={index === 0 ? 'Название подстанции' : `Название дома ${index}`}
                      maxLength={30} value={name} onChange={event => edit({
                        ...graph, nodes: nodes.map(node => node.id === index ? { ...node, name: event.target.value } : node),
                      })} />
                  </label>)}
                </div>
              </section>
              <section className="power-panel">
                <h2>Допустимые соединения <small>{edges.length}</small></h2>
                <form className="power-cable-form" onSubmit={addCable}>
                  <label>Откуда<select className="power-control" value={from} onChange={event => setFrom(Number(event.target.value))}><ObjectOptions names={names} /></select></label>
                  <label>Куда<select className="power-control" value={to} onChange={event => setTo(Number(event.target.value))}><ObjectOptions names={names} /></select></label>
                  <label>Стоимость<input className="power-control" type="number" min="0" max={MAX_COST} step="1" required value={cost} onChange={event => setCost(event.target.value)} /></label>
                  <IconButton type="submit" icon="plus" label="Добавить соединение" disabled={names.length < 2} />
                </form>
                <div className="power-edges">
                  {edges.length === 0 && <p className="power-empty">Добавьте допустимые соединения.</p>}
                  {edges.map(({ from: a, to: b, weight }, index) => <div key={index}
                    className={`power-edge ${chosen.has(index) ? 'wired' : ''} ${selected?.type === 'edge' && selected.id === index ? 'active' : ''}`}>
                    <span>{chosen.has(index) && <Icon name="check" size={14} />}{names[a]} — {names[b]}</span>
                    <input className="power-control" type="number" min="0" max={MAX_COST} step="1"
                      aria-label={`Стоимость соединения ${names[a]} — ${names[b]}`} value={weight}
                      onChange={event => edit({ ...graph, edges: edges.map((edge, i) => i === index ? { ...edge, weight: event.target.value } : edge) })} />
                    <IconButton icon="trash" label={`Удалить соединение ${names[a]} — ${names[b]}`}
                      onClick={() => {
                        setSelected(null);
                        edit({ ...graph, edges: edges.filter((_, i) => i !== index) });
                      }} />
                  </div>)}
                </div>
              </section>
              <button className="button primary power-run" type="button" disabled={busy} onClick={calculate}>
                <Icon name="arrange" size={20} />{busy ? 'Расчёт…' : 'Рассчитать сеть'}
              </button>
              {error && <p className="power-error" role="alert">{error}</p>}
              <PlanResult result={result} frame={frame} finished={finished} names={names} edges={edges} />
            </aside></>}
        </div>
      </section>
    </main>
  </div>;
}
