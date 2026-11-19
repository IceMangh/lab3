import test from 'node:test';
import assert from 'node:assert/strict';
import { cableLabelPositions, cableOffsets, exampleDistrict, generateDistrict, makeCityDistrict, powerFrame, powerSteps } from '../src/power/district.js';

test('generated districts have connected local cables and a substation on the outskirts', () => {
  for (let houses = 0; houses <= 99; houses++) {
    const { nodes, edges, city } = generateDistrict(houses, houses * 17);
    assert.equal(nodes.length, houses + 1);
    assert.ok(nodes.slice(1).every(home => home.x > nodes[0].x));
    const neighbors = nodes.map(() => []);
    for (const { from, to, weight } of edges) {
      assert.ok(from < to && Number.isInteger(weight) && weight >= 0);
      neighbors[from].push(to);
      neighbors[to].push(from);
    }
    const reachable = new Set([0]);
    for (const id of reachable) neighbors[id].forEach(next => reachable.add(next));
    assert.equal(reachable.size, nodes.length);
    assert.equal(city.places.filter(p => p.kind === 'square').length, 1);
    assert.ok(city.places.some(p => p.kind === 'park'));
  }
});

test('a town keeps its street plan, house locations and architecture when rebuilt with its seed', () => {
  const g = generateDistrict(16, 91);
  const rebuilt = makeCityDistrict(g.nodes.map(n => n.name), g.edges, g.city.seed);
  assert.deepEqual(rebuilt, g);
  assert.notDeepEqual(generateDistrict(16, 92).nodes, g.nodes);
});

test('cable prices clear a tall roof and the opposite house label on a short vertical span', () => {
  const nodes = [{ name: 'A', x: 0, y: 0 }, { name: 'B', x: 0, y: 95, building: 'apartment' }];
  const edges = [{ from: 0, to: 1, weight: 12 }];
  const [price] = cableLabelPositions(nodes, edges, cableOffsets(edges));
  assert.ok(price.anchor);
  assert.ok(Math.abs(price.x) > 55);
});

test('Kruskal frames show progressive cost, cycles and power only after a path reaches the station', () => {
  const { edges, nodes } = exampleDistrict();
  const steps = powerSteps(edges, [edges[0], edges[2], edges[4]]);
  assert.deepEqual(steps.map(s => s.index), [2, 4, 0, 3, 1]);
  assert.deepEqual(steps.map(s => s.accepted), [true, true, true, false, false]);
  const frames = Array.from({ length: 6 }, (_, i) => powerFrame(steps, i, edges, nodes.length));
  assert.deepEqual(frames.map(f => f.cost), [0, 2, 5, 9, 9, 9]);
  assert.deepEqual(frames.map(f => f.powered.size), [1, 1, 1, 4, 4, 4]);
  assert.deepEqual(powerFrame(steps, 1, edges, nodes.length), frames[1]);
});

test('ties and identical parallel lines produce a valid cycle decision in a disconnected forest', () => {
  const edges = [[1, 2], [1, 0], [0, 1], [0, 2], [3, 4]].map(([from, to]) => ({ from, to, weight: 0 }));
  const steps = powerSteps(edges, [edges[1], edges[3], edges[4]]);
  assert.deepEqual(steps.filter(s => s.accepted).map(s => s.index), [1, 3, 4]);
  assert.deepEqual(steps.filter(s => !s.accepted).map(s => s.index), [0, 2]);
  for (let i = 0; i < steps.length; i++) {
    if (steps[i].accepted) continue;
    const { powered } = powerFrame(steps, i, edges, 5);
    assert.ok(powered.has(edges[steps[i].index].from) && powered.has(edges[steps[i].index].to));
  }
  assert.deepEqual([...powerFrame(steps, steps.length, edges, 5).powered], [0, 1, 2]);
});
