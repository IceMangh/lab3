import { boundCoordinate } from './camera.js';

export const MODES = [
  { id: 'color', label: 'Раскраска графа', algorithm: 'greedy' },
  { id: 'path', label: 'Поиск пути', algorithm: 'dijkstra' },
  { id: 'tree', label: 'Минимальный остов', algorithm: 'kruskal' },
  { id: 'components', label: 'Компоненты связности', algorithm: 'components' },
];

export const ALGORITHMS = {
  greedy: { name: 'Жадная раскраска', description: 'Соседние вершины получают разные цвета.', complexity: 'O(V² + E)' },
  dijkstra: { name: 'Алгоритм Дейкстры', description: 'Кратчайший путь с учётом неотрицательных весов.', complexity: 'O(V² + E)' },
  bfs: { name: 'Поиск в ширину · BFS', description: 'Кратчайший путь по числу рёбер. Веса не учитываются.', complexity: 'O(V + E)' },
  kruskal: { name: 'Алгоритм Краскала', description: 'Соединяем вершины с минимальной суммой весов.', complexity: 'O(E² + V²)' },
  components: { name: 'Компоненты связности · DFS', description: 'Группы вершин, соединённых путями. Веса не учитываются.', complexity: 'O(V + E)' },
};

export const PALETTE = ['#ccff80', '#aa9aff', '#ffb887', '#7cd9e7', '#ff8bb3', '#f3dd83', '#97bfff', '#e9a1ff'];
export const vertexColor = (index) => PALETTE[index] || `hsl(${(index * 137.508) % 360} 70% 72%)`;
export function plural(count, forms) {
  const n = Math.abs(count) % 100;
  return forms[n > 10 && n < 20 ? 2 : n % 10 === 1 ? 0 : n % 10 > 1 && n % 10 < 5 ? 1 : 2];
}

export function demoGraph() {
  return {
    nodes: [[190, 255], [345, 95], [610, 95], [840, 165], [415, 270], [610, 270], [290, 420], [670, 420]]
      .map(([x, y], id) => ({ id, x, y })),
    edges: [[0, 1, 3], [1, 2, 4], [2, 3, 6], [0, 4, 5], [1, 4, 2], [2, 5, 1],
      [4, 5, 3], [0, 6, 7], [4, 6, 4], [6, 7, 8], [5, 7, 2]]
      .map(([from, to, weight]) => ({ from, to, weight })),
    directed: false,
    weighted: true,
  };
}

export function circleNodes(count) {
  if (count > 16) {
    return Array.from({ length: count }, (_, id) => {
      const radius = 67 * Math.sqrt(id), angle = id * Math.PI * (3 - Math.sqrt(5));
      return { id, x: 500 + radius * Math.cos(angle), y: 250 + radius * Math.sin(angle) };
    });
  }
  return Array.from({ length: count }, (_, id) => ({
    id,
    x: count === 1 ? 500 : 500 + 335 * Math.cos((id / count) * 2 * Math.PI - Math.PI / 2),
    y: count === 1 ? 260 : 260 + 195 * Math.sin((id / count) * 2 * Math.PI - Math.PI / 2),
  }));
}

export function generateGraph(count, density, preset, settings = {}) {
  if (preset === 'demo') return { ...demoGraph(), ...settings };
  const nodes = circleNodes(count);
  const edges = [];
  const add = (from, to) => {
    if (edges.length < 5000) edges.push({ from, to, weight: 1 + Math.floor(Math.random() * 9) });
  };
  if (preset === 'disconnected') {
    const groups = Math.min(3, count);
    const radius = Math.max(70, Math.sqrt(Math.ceil(count / (groups || 1))) * 45);
    for (let group = 0; group < groups; group++) {
      const start = Math.ceil(group * count / groups), end = Math.ceil((group + 1) * count / groups);
      for (let id = start; id < end; id++) {
        const angle = (id - start) / (end - start) * 2 * Math.PI - Math.PI / 2;
        const localRadius = end - start === 1 ? 0 : radius;
        nodes[id] = { id, x: 170 + group * (radius * 2 + 160) + localRadius * Math.cos(angle), y: 250 + localRadius * Math.sin(angle) };
        if (id > start) add(id - 1, id);
      }
    }
  } else if (preset !== 'empty') {
    for (let i = 1; i < count; i++) add(i - 1, i);
    if (count > 2) add(count - 1, 0);
    if (preset === 'random') {
      for (let from = 0; from < count; from++) {
        for (let to = settings.directed ? 0 : from + 1; to < count; to++) {
          if (from !== to && !edges.some(e => e.from === from && e.to === to || !settings.directed && e.from === to && e.to === from)
            && Math.random() * 100 < density) add(from, to);
        }
      }
    }
  }
  return { nodes, edges, directed: false, weighted: true, ...settings };
}

export function validateGraph(input) {
  if (!input || !Array.isArray(input.nodes) || !Array.isArray(input.edges)) throw new Error('В JSON нужны массивы nodes и edges.');
  if (input.nodes.length > 100 || input.edges.length > 5000) throw new Error('Допустимо до 100 вершин и 5000 рёбер.');
  const defaults = circleNodes(input.nodes.length);
  const nodes = input.nodes.map((node, id) => {
    if (!node || node.id !== id) throw new Error('Номера вершин должны идти подряд, начиная с 0.');
    return { id, x: Number.isFinite(node.x) ? boundCoordinate(node.x) : defaults[id].x,
      y: Number.isFinite(node.y) ? boundCoordinate(node.y) : defaults[id].y };
  });
  if (input.directed !== undefined && typeof input.directed !== 'boolean' || input.weighted !== undefined && typeof input.weighted !== 'boolean') {
    throw new Error('directed и weighted должны быть логическими значениями.');
  }
  const directed = input.directed ?? false;
  const seen = new Set();
  const edges = input.edges.map(edge => {
    if (!edge || !Number.isInteger(edge.from) || !Number.isInteger(edge.to) || edge.from < 0 || edge.to < 0 || edge.from >= nodes.length || edge.to >= nodes.length) {
      throw new Error('Ребро ссылается на несуществующую вершину.');
    }
    const weight = edge.weight ?? 1;
    if (!Number.isInteger(weight) || Math.abs(weight) > 10000) throw new Error('Вес — целое число от −10000 до 10000.');
    const key = directed ? `${edge.from}:${edge.to}` : [edge.from, edge.to].sort((a, b) => a - b).join(':');
    if (seen.has(key)) throw new Error('Граф содержит повторяющиеся рёбра.');
    seen.add(key);
    return { from: edge.from, to: edge.to, weight };
  });
  return { nodes, edges, directed, weighted: input.weighted ?? true };
}

export function loadGraph() {
  try {
    const saved = localStorage.getItem('graph-lab-v1');
    return saved ? validateGraph(JSON.parse(saved)) : demoGraph();
  } catch { return demoGraph(); }
}

export function parseEdgeList(text, count, settings) {
  const edges = text.split('\n').map(line => line.trim()).filter(Boolean).map((line, index) => {
    const values = line.split(/[\s,;]+/).map(Number);
    if (values.length < 2 || values.length > 3 || values.some(v => !Number.isInteger(v))) throw new Error(`Строка ${index + 1}: используйте формат «откуда куда вес».`);
    return { from: values[0], to: values[1], weight: values[2] ?? 1 };
  });
  return validateGraph({ nodes: circleNodes(count), edges, ...settings });
}

export function deleteNode(graph, id) {
  return { ...graph,
    nodes: graph.nodes.filter(node => node.id !== id).map((node, id) => ({ ...node, id })),
    edges: graph.edges.filter(edge => edge.from !== id && edge.to !== id)
      .map(edge => ({ ...edge, from: edge.from > id ? edge.from - 1 : edge.from, to: edge.to > id ? edge.to - 1 : edge.to })),
  };
}

export const frameCount = (result) => !result ? 0 : result.algorithm === 'greedy' ? result.colors.length
  : result.algorithm === 'components' ? result.steps?.length || 0
  : result.algorithm === 'kruskal' ? result.tree.length : result.path.length || result.order.length;

export function componentFrame(result, step) {
  const assigned = Array(result.components.length).fill(-1);
  const stack = [], edges = [], finished = new Set(), groups = [];
  const events = (result.steps || []).slice(0, step);
  let current = null;
  for (const event of events) {
    if (event.entering) {
      assigned[event.vertex] = event.component;
      (groups[event.component] ||= []).push(event.vertex);
      stack.push(event.vertex);
      if (event.parent !== -1) edges.push([event.parent, event.vertex]);
      current = event.vertex;
    } else {
      stack.pop();
      if (event.parent === -1) finished.add(event.component);
      current = event.parent === -1 ? null : event.parent;
    }
  }
  return { assigned, stack, edges, finished, groups, current, visited: assigned.filter(group => group !== -1).length,
    last: events.at(-1) || null };
}

export function frameMessage(result, step) {
  if (!result) return '';
  if (result.algorithm === 'components') {
    if (!result.components.length) return 'Граф пуст: компонент связности нет.';
    if (!step) return 'Начало поиска. Все вершины ещё не посещены.';
    const event = result.steps[step - 1];
    if (event.entering) return event.parent === -1
      ? `Начинаем компоненту ${event.component + 1}: посещаем вершину ${event.vertex}.`
      : `По ребру ${event.parent} — ${event.vertex} переходим в вершину ${event.vertex}. Компонента ${event.component + 1}.`;
    if (event.parent !== -1) return `Вершина ${event.vertex} обработана. Возвращаемся к вершине ${event.parent}.`;
    return `Компонента ${event.component + 1} завершена. ${step === result.steps.length ? 'Поиск завершён.' : 'Ищем следующую непосещённую вершину.'}`;
  }
  if (!step) return 'Результат рассчитан. Нажмите воспроизведение, чтобы рассмотреть его по шагам.';
  if (result.algorithm === 'greedy') return `Вершина ${step - 1} получает цвет ${result.colors[step - 1] + 1}.`;
  if (result.algorithm === 'kruskal') {
    const edge = result.tree[step - 1];
    return `Добавляем ребро ${edge.from} — ${edge.to}, вес ${edge.weight}. Цикл не возникает.`;
  }
  if (!result.path.length) return `Вершина ${result.order[step - 1]} достижима. Пути до выбранной цели нет.`;
  return `Маршрут: ${result.path.slice(0, step).join(' → ')}${step === result.path.length ? '. Путь найден.' : ''}`;
}

export function downloadFile(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportCSV(graph, result) {
  const rows = [['type', 'from', 'to', 'weight', 'vertex', 'color', 'distance', 'algorithm', 'elapsed_ms', 'component'],
    ['settings', 'directed', Number(graph.directed), 'weighted', Number(graph.weighted)]];
  graph.nodes.forEach(node => rows.push(['vertex', '', '', '', node.id, result?.colors[node.id] ?? '',
    result?.distances[node.id] === -1 ? 'unreachable' : result?.distances[node.id] ?? '', '', '', result?.components?.[node.id] ?? '']));
  graph.edges.forEach(edge => rows.push(['edge', edge.from, edge.to, graph.weighted ? edge.weight : 1]));
  if (result) {
    rows.push(['result', '', '', '', '', '', '', result.algorithm, result.elapsedMs]);
    result.path.forEach((id, index) => rows.push(['path', index, '', '', id]));
    result.tree.forEach(edge => rows.push(['tree', edge.from, edge.to, edge.weight]));
    rows.push(['total_weight', '', '', result.totalWeight]);
    rows.push(['color_count', '', '', '', result.colorCount]);
    rows.push(['component_count', '', '', '', result.componentCount]);
  }
  return '\uFEFF' + rows.map(row => row.join(',')).join('\r\n');
}
