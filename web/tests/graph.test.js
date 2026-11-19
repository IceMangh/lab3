import test from 'node:test';
import assert from 'node:assert/strict';
import { componentFrame, deleteNode, demoGraph, exportCSV, frameCount, frameMessage, generateGraph, parseEdgeList, validateGraph } from '../src/lib/graph.js';

test('deleting a vertex removes incident edges and renumbers remaining endpoints', () => {
  const graph = parseEdgeList('0 1 2\n1 2 4\n0 2 7\n2 3 9', 4, {});
  const next = deleteNode(graph, 1);
  assert.deepEqual(next.nodes.map(n => n.id), [0, 1, 2]);
  assert.deepEqual(next.edges, [{ from: 0, to: 1, weight: 7 }, { from: 1, to: 2, weight: 9 }]);
  assert.equal(graph.nodes.length, 4);
});

test('JSON graph export can be imported with settings and positions intact', () => {
  const graph = { ...demoGraph(), directed: true, weighted: false };
  assert.deepEqual(validateGraph(JSON.parse(JSON.stringify(graph))), graph);
});

test('vertices outside the original board survive save and import', () => {
  const graph = { nodes: [{ id: 0, x: -1200, y: 2800 }], edges: [] };
  assert.deepEqual(validateGraph(graph).nodes, graph.nodes);
});

test('larger generated layouts keep vertices separated', () => {
  const graph = generateGraph(70, 0, 'empty');
  for (let i = 0; i < graph.nodes.length; i++) for (let j = i + 1; j < graph.nodes.length; j++) {
    assert.ok(Math.hypot(graph.nodes[i].x - graph.nodes[j].x, graph.nodes[i].y - graph.nodes[j].y) > 50);
  }
});

test('manual entry accepts whitespace, commas, negative and zero weights', () => {
  const graph = parseEdgeList('0, 1, -3\n\n1 2 0\n2; 3', 4, { directed: true, weighted: true });
  assert.deepEqual(graph.edges.map(e => e.weight), [-3, 0, 1]);
  assert.equal(graph.directed, true);
});

test('manual entry rejects malformed and out-of-range endpoints', () => {
  for (const text of ['0 4 1', '-1 2 1', '0 1 nan', '0 1 2 3', '0 1 1.5']) {
    assert.throws(() => parseEdgeList(text, 3, {}));
  }
});

test('undirected imports reject reverse duplicates; directed imports preserve both directions', () => {
  assert.throws(() => parseEdgeList('0 1\n1 0', 2, {}), /повторяющиеся/);
  assert.equal(parseEdgeList('0 1\n1 0', 2, { directed: true }).edges.length, 2);
});

test('import rejects invalid IDs, weights, flags, and unsafe positions are bounded', () => {
  const graph = demoGraph();
  assert.throws(() => validateGraph({ ...graph, nodes: [{ id: 3 }] }));
  assert.throws(() => validateGraph({ ...graph, edges: [{ from: 0, to: 1, weight: 10001 }] }));
  assert.throws(() => validateGraph({ ...graph, directed: 'false' }));
  const next = validateGraph({ nodes: [{ id: 0, x: -1e8, y: 1e8 }], edges: [] });
  assert.deepEqual(next.nodes[0], { id: 0, x: -100000, y: 100000 });
});

test('random generator has no duplicate edges and remains connected', () => {
  for (const directed of [true, false]) for (const count of [0, 1, 2, 8, 30]) {
    const graph = generateGraph(count, 35, 'random', { directed });
    assert.doesNotThrow(() => validateGraph(graph));
    const reached = new Set(count ? [0] : []);
    for (let i = 0; i < count; i++) for (const edge of graph.edges) {
      if (reached.has(edge.from)) reached.add(edge.to);
      if (!directed && reached.has(edge.to)) reached.add(edge.from);
    }
    assert.equal(reached.size, count);
  }
});

test('empty graph and single-node cycle create no invalid self-loop', () => {
  assert.equal(generateGraph(0, 0, 'empty').nodes.length, 0);
  assert.deepEqual(generateGraph(1, 50, 'cycle').edges, []);
});

test('disconnected example creates exactly three groups, including small and empty cases', () => {
  for (const count of [0, 1, 2, 3, 8, 20, 100]) {
    const graph = generateGraph(count, 50, 'disconnected');
    assert.doesNotThrow(() => validateGraph(graph));
    assert.equal(graph.nodes.length, count);
    const groups = [];
    const visited = new Set();
    for (let start = 0; start < count; start++) {
      if (visited.has(start)) continue;
      const queue = [start]; visited.add(start);
      for (let head = 0; head < queue.length; head++) for (const edge of graph.edges) {
        const to = edge.from === queue[head] ? edge.to : edge.to === queue[head] ? edge.from : -1;
        if (to >= 0 && !visited.has(to)) { visited.add(to); queue.push(to); }
      }
      groups.push(queue);
    }
    assert.equal(groups.length, Math.min(3, count));
  }
});

function componentTrace() {
  return { algorithm: 'components', componentCount: 3, components: [0, 0, 1, 2], steps: [
    [0, -1, 0, true], [1, 0, 0, true], [1, 0, 0, false], [0, -1, 0, false],
    [2, -1, 1, true], [2, -1, 1, false], [3, -1, 2, true], [3, -1, 2, false],
  ].map(([vertex, parent, component, entering]) => ({ vertex, parent, component, entering })) };
}

test('component playback visits one vertex per discovery and tracks DFS returns', () => {
  const result = componentTrace();
  assert.equal(frameCount(result), 8);
  const first = componentFrame(result, 1);
  assert.deepEqual(first.assigned, [0, -1, -1, -1]);
  assert.deepEqual(first.stack, [0]);
  assert.deepEqual(first.groups, [[0]]);
  const second = componentFrame(result, 2);
  assert.deepEqual(second.stack, [0, 1]);
  assert.deepEqual(second.edges, [[0, 1]]);
  assert.equal(second.current, 1);
  const back = componentFrame(result, 3);
  assert.equal(back.current, 0);
  assert.deepEqual(back.stack, [0]);
  assert.equal(back.visited, 2);
  assert.ok(componentFrame(result, 4).finished.has(0));
  const final = componentFrame(result, 8);
  assert.deepEqual(final.groups, [[0, 1], [2], [3]]);
  assert.equal(final.finished.size, 3);
  assert.deepEqual(final.stack, []);
  assert.equal(final.current, null);
  assert.match(frameMessage(result, 2), /По ребру 0 — 1/);
  assert.match(frameMessage(result, 3), /Возвращаемся к вершине 0/);
  assert.match(frameMessage(result, 8), /Поиск завершён/);
  assert.equal(frameCount({ ...result, componentCount: 0, components: [], steps: [] }), 0);
});

test('rewinding a DFS trace restores an earlier state without changing recorded steps', () => {
  const result = componentTrace(), original = JSON.stringify(result);
  const before = componentFrame(result, 2);
  componentFrame(result, result.steps.length);
  assert.deepEqual(componentFrame(result, 2), before);
  assert.equal(JSON.stringify(result), original);
  const start = componentFrame(result, 0);
  assert.equal(start.visited, 0);
  assert.deepEqual(start.groups, []);
  assert.deepEqual(start.stack, []);
});

test('CSV records component membership per vertex', () => {
  const graph = parseEdgeList('0 1', 3, {});
  const result = { algorithm: 'components', components: [0, 0, 1], componentCount: 2,
    colors: [], distances: [], path: [], tree: [], totalWeight: 0, colorCount: 0, elapsedMs: .01 };
  const rows = exportCSV(graph, result).split('\r\n').map(row => row.split(','));
  assert.equal(rows[0][9], 'component');
  assert.deepEqual(rows.filter(row => row[0] === 'vertex').map(row => row[9]), ['0', '0', '1']);
});

test('dense directed generator respects the server edge limit', () => {
  const graph = generateGraph(100, 75, 'random', { directed: true });
  assert.equal(graph.nodes.length, 100);
  assert.ok(graph.edges.length <= 5000);
  assert.doesNotThrow(() => validateGraph(graph));
});

test('CSV exports isolates, unit weights and execution timing', () => {
  const graph = { ...parseEdgeList('0 1 9', 3, {}), weighted: false };
  const result = { algorithm: 'bfs', colors: [], distances: [0, 1, -1], path: [0, 1], tree: [], totalWeight: 0, colorCount: 0, componentCount: 0, elapsedMs: .123 };
  const csv = exportCSV(graph, result);
  assert.match(csv, /edge,0,1,1/);
  assert.match(csv, /vertex,,,,2,,unreachable/);
  assert.match(csv, /bfs,0.123/);
});

test('playback reveals path or reachable vertices when no path exists', () => {
  const result = { algorithm: 'dijkstra', colors: [], path: [0, 2, 3], order: [0, 2, 1, 3] };
  assert.equal(frameCount(result), 3);
  assert.match(frameMessage(result, 2), /0 → 2/);
  assert.match(frameMessage(result, 3), /Путь найден/);
  assert.equal(frameCount({ ...result, path: [] }), 4);
  assert.match(frameMessage({ ...result, path: [] }, 2), /Пути.*нет/);
});
