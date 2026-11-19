import { useCallback, useEffect, useRef, useState } from 'react';
import { usePlayback } from './usePlayback';
import { MODES, deleteNode, frameCount, loadGraph } from './graph';

export function useLab() {
  const [graph, setGraph] = useState(loadGraph);
  const [mode, setMode] = useState('color');
  const [algorithm, setAlgorithm] = useState('greedy');
  const [start, setStart] = useState(0);
  const [target, setTarget] = useState(() => Math.max(0, graph.nodes.length - 1));
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const controller = useRef(null);
  const requestVersion = useRef(0);
  const playback = usePlayback(frameCount(result));
  const { restart } = playback;

  const invalidate = useCallback(() => {
    requestVersion.current++;
    controller.current?.abort();
    setBusy(false); setResult(null); restart(); setError('');
  }, [restart]);

  const updateGraph = useCallback((next, invalidateResult = true) => {
    if (invalidateResult) invalidate();
    setGraph(previous => typeof next === 'function' ? next(previous) : next);
  }, [invalidate]);

  useEffect(() => {
    try { localStorage.setItem('graph-lab-v1', JSON.stringify(graph)); } catch { /* Хранилище может быть запрещено браузером. */ }
    setStart(value => Math.max(0, Math.min(value, graph.nodes.length - 1)));
    setTarget(value => Math.max(0, Math.min(value, graph.nodes.length - 1)));
  }, [graph]);

  useEffect(() => () => controller.current?.abort(), []);

  function changeMode(next) {
    invalidate(); setMode(next); setSelected(null);
    setAlgorithm(MODES.find(item => item.id === next).algorithm);
  }

  function changeParameter(setter, value) { invalidate(); setter(value); }

  function removeSelected() {
    if (!selected) return;
    updateGraph(previous => selected.type === 'node' ? deleteNode(previous, selected.id)
      : { ...previous, edges: previous.edges.filter((_, index) => index !== selected.id) });
    setSelected(null);
  }

  async function run() {
    invalidate();
    const version = requestVersion.current;
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    try {
      const response = await fetch('/api/solve', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: abort.signal,
        body: JSON.stringify({ algorithm, vertexCount: graph.nodes.length, edges: graph.edges,
          directed: graph.directed, weighted: graph.weighted, start, target }),
      });
      const data = await response.json().catch(() => { throw new Error('Сервер алгоритмов недоступен. Запустите python3 server.py из папки лабы.'); });
      if (!response.ok) throw new Error(data.error || 'Не удалось выполнить алгоритм.');
      if (algorithm === 'components' && !Array.isArray(data.steps)) throw new Error('Для пошагового поиска перезапустите сервер: Ctrl+C, затем ./run.sh.');
      if (version !== requestVersion.current) return;
      if (algorithm === 'kruskal') data.tree.sort((a, b) => a.weight - b.weight);
      setResult(data); restart(frameCount(data) > 0);
    } catch (error) {
      if (error.name !== 'AbortError' && version === requestVersion.current) {
        setError(error instanceof TypeError ? 'Нет связи с сервером. Запустите python3 server.py из папки лабы.' : error.message);
      }
    } finally { if (version === requestVersion.current) setBusy(false); }
  }

  return { graph, updateGraph, mode, changeMode, algorithm, setAlgorithm: value => changeParameter(setAlgorithm, value),
    start, setStart: value => changeParameter(setStart, value), target, setTarget: value => changeParameter(setTarget, value),
    selected, setSelected, removeSelected, result, ...playback, busy, error, setError, run };
}
