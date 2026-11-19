import { planTown, townRandom } from './townLayout.js';

export const MAX_HOUSES = 99;
export const MAX_CABLES = 5000;
export const MAX_COST = 2_147_483_647;

export function houseName(index) {
  return index <= 8 ? String.fromCharCode(64 + index) : String(index);
}

export function nextHouseName(index, used) {
  while (used.has(houseName(index))) index++;
  return houseName(index);
}

export function exampleDistrict() {
  return makeCityDistrict(['S', 'A', 'B', 'C'], [
    { from: 0, to: 1, weight: 4 }, { from: 0, to: 2, weight: 7 },
    { from: 1, to: 2, weight: 2 }, { from: 1, to: 3, weight: 6 },
    { from: 2, to: 3, weight: 3 },
  ], 314);
}

function placeFountain(city, nodes, edges) {
  const square = city.places.find(place => place.kind === 'square');
  let best = -Infinity;
  for (const [x, y] of square.candidates) {
    let clearance = Infinity;
    for (const { from, to } of edges) {
      const a = nodes[from], b = nodes[to];
      const dx = b.x - a.x, dy = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1)));
      clearance = Math.min(clearance, Math.hypot(x - a.x - dx * t, y - a.y - dy * t));
    }
    if (clearance > best) {
      best = clearance;
      square.x = x;
      square.y = y;
    }
    if (best >= 52) break;
  }
}

export function makeCityDistrict(names, edges, seed) {
  const { points, city } = planTown(names.length - 1, seed);
  const nodes = names.map((name, id) => ({ id, name, ...points[id] }));
  const cables = edges ?? nearbyCables(nodes, seed);
  placeFountain(city, nodes, cables);
  return { city, nodes, edges: cables, directed: false, weighted: true };
}

export function generateDistrict(houses, seed = Math.floor(Math.random() * 2 ** 32)) {
  const names = ['S', ...Array.from({ length: houses }, (_, index) => houseName(index + 1))];
  return makeCityDistrict(names, null, seed);
}

function nearbyCables(nodes, seed) {
  const random = townRandom(seed ^ 0x9e3779b9);
  const edges = [];
  for (const a of nodes) {
    for (let to = a.id + 1; to < nodes.length; to++) {
      const b = nodes[to];
      // Соседи по Габриэлю: круг с диаметром AB свободен от других зданий.
      const blocked = nodes.some(p => p !== a && p !== b &&
        (p.x - a.x) * (p.x - b.x) + (p.y - a.y) * (p.y - b.y) <= 0);
      if (blocked) continue;
      const length = Math.hypot(a.x - b.x, a.y - b.y);
      edges.push({ from: a.id, to, weight: Math.round(length / 24) + 1 + Math.floor(random() * 10) });
    }
  }
  return edges;
}

export function readCost(input) {
  const cost = Number(input);
  if (!/^\d+$/.test(String(input)) || !Number.isInteger(cost) || cost > MAX_COST) {
    throw new Error('Стоимость кабеля должна быть целым числом от 0 до 2 147 483 647.');
  }
  return cost;
}

export function cableKey({ from, to, weight }) {
  return `${Math.min(from, to)}:${Math.max(from, to)}:${Number(weight)}`;
}

export function selectedIndices(edges, tree) {
  const remaining = new Set(tree.map(cableKey));
  return new Set(edges.flatMap((edge, index) => remaining.delete(cableKey(edge)) ? [index] : []));
}

export function cableOffsets(edges) {
  const groups = new Map();
  edges.forEach(({ from, to }, index) => {
    const key = `${Math.min(from, to)}:${Math.max(from, to)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(index);
  });
  const offsets = Array(edges.length);
  for (const group of groups.values()) {
    group.forEach((index, position) => {
      const { from, to } = edges[index];
      offsets[index] = (from <= to ? 1 : -1) * (position - (group.length - 1) / 2) * Math.min(48, 240 / group.length);
    });
  }
  return offsets;
}

export function cableLabelPositions(nodes, edges, offsets) {
  const obstacles = nodes.flatMap(node => {
    const labelWidth = Math.min(12, node.name.length || 1) * 10;
    const roofHeight = node.building === 'apartment' ? 68 : 54;
    return [
      { left: node.x - 40, right: node.x + 40, top: node.y - roofHeight, bottom: node.y + 28 },
      { left: node.x - 22 - labelWidth, right: node.x - 18, top: node.y + 24, bottom: node.y + 45 },
    ];
  });
  return edges.map(({ from, to, weight }, index) => {
    const a = nodes[from], b = nodes[to];
    const dx = b.x - a.x, dy = b.y - a.y;
    const length = Math.hypot(dx, dy) || 1;
    const halfWidth = Math.max(15, String(weight).length * 4.5 + 6) + 2;
    const pointAt = t => {
      const bend = 2 * t * (1 - t) * offsets[index];
      return { x: a.x + t * dx - bend * dy / length, y: a.y + t * dy + bend * dx / length };
    };
    function fits(x, y) {
      const box = { left: x - halfWidth, right: x + halfWidth, top: y - 14, bottom: y + 14 };
      if (obstacles.some(o => o.left < box.right && o.right > box.left && o.top < box.bottom && o.bottom > box.top)) return false;
      obstacles.push(box);
      return true;
    }
    for (const t of [.5, .43, .57, .36, .64, .30, .70]) {
      const p = pointAt(t);
      if (fits(p.x, p.y)) return p;
    }
    for (const distance of [22, 36, 52, 68]) {
      for (const t of [.5, .4, .6]) {
        const anchor = pointAt(t);
        for (const shift of [distance, -distance]) {
          const x = anchor.x - shift * dy / length, y = anchor.y + shift * dx / length;
          if (fits(x, y)) return { x, y, anchor };
        }
      }
    }
    return pointAt(.5);
  });
}

export function powerSteps(edges, forest) {
  const chosen = selectedIndices(edges, forest);
  return edges.map((edge, index) => ({ index, accepted: chosen.has(index) }))
    .sort((a, b) => edges[a.index].weight - edges[b.index].weight || Number(b.accepted) - Number(a.accepted));
}

export function powerFrame(steps, step, edges, nodeCount) {
  const chosen = new Set();
  const neighbors = Array.from({ length: nodeCount }, () => []);
  let cost = 0;
  for (const { index, accepted } of steps.slice(0, step)) {
    if (!accepted) continue;
    const edge = edges[index];
    chosen.add(index);
    cost += Number(edge.weight);
    neighbors[edge.from].push(edge.to);
    neighbors[edge.to].push(edge.from);
  }

  const powered = new Set([0]);
  for (const vertex of powered) {
    for (const neighbor of neighbors[vertex]) powered.add(neighbor);
  }
  return { chosen, cost, powered, current: steps[step - 1] };
}
