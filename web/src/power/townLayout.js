export function townRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function trace(pointAt, segments = 8) {
  return Array.from({ length: segments + 1 }, (_, i) => pointAt(i / segments).join(',')).join(' L');
}

export function planTown(houses, seed) {
  const random = townRandom(seed);
  const between = (a, b) => a + (b - a) * random();
  const rows = Math.max(2, Math.round(Math.sqrt(houses * .53)));
  const highStreet = Math.ceil(rows / 2);
  const squareRow = highStreet - 1;
  const width = Math.max(370, (Math.ceil(houses / rows) + 1.15) * 138);
  const phase = between(-1, 1);
  const heights = [0];
  for (let r = 0; r < rows; r++) heights.push(heights[r] + between(197, 232));

  function map(u, r) {
    const band = Math.min(Math.floor(r), rows - 1);
    const y = heights[band] + (heights[band + 1] - heights[band]) * (r - band);
    const taper = Math.abs(2 * r / rows - 1);
    const x = width * (.5 + (u - .5) * (1 - .10 * taper))
      + 40 * Math.sin(r * 1.54 + phase) + 21 * Math.sin(r * 2.1 + u * 4);
    const bend = (33 + 9 * Math.cos(r + phase)) * Math.sin(u * 5.2 + .48 * r + phase);
    return [Math.round(x), Math.round(y - .11 * (u - .5) * width + bend)];
  }

  const roads = [], blocks = [], places = [], points = [];
  const outline = [];
  for (let r = 0; r <= rows; r++) {
    const main = r === highStreet;
    const start = main ? -105 / width : 0, end = main ? 1 + 65 / width : 1;
    const street = trace(t => {
      const point = map(start + (end - start) * t, r);
      outline.push(point);
      return point;
    }, 30);
    roads.push({ d: 'M' + street, kind: main ? 'avenue' : 'lane' });
  }

  const [gateX, gateY] = map(-92 / width, highStreet);
  points.push({ x: gateX - 14, y: gateY - 66 });
  places.push({ kind: 'utility', ...points[0] });
  roads.push({ d: `M${gateX},${gateY}l-14,-34v-32`, kind: 'drive' });

  for (let r = 0; r < rows; r++) {
    const count = Math.floor(houses / rows) + Number(r < houses % rows);
    const lots = Array(count).fill('house');
    if (r === squareRow) lots.splice(Math.ceil(count / 2), 0, 'square');
    if (r === highStreet || (r !== squareRow && r % 3 === 0)) {
      lots.splice(Math.floor(count * between(.24, .72)), 0, 'park');
    }
    if (r === 0 || (rows > 2 && r === rows - 1)) lots.splice(random() < .5 ? 0 : lots.length, 0, 'vacant');

    const widths = lots.map(kind => kind === 'vacant' ? .72 : kind === 'square' ? 1.32 : between(.92, 1.16));
    const total = widths.reduce((sum, w) => sum + w, 0);
    let start = 0, streetTop = 0, streetBottom = 0;
    function sideStreet(top, bottom) {
      const d = 'M' + trace(t => map(top + (bottom - top) * t, r + t), 5);
      roads.push({ d, kind: 'side' });
    }
    sideStreet(0, 0);
    for (let i = 0; i < lots.length;) {
      const kind = lots[i];
      let end = i + 1;
      if (kind === 'house') {
        const capacity = random() < .46 ? 2 : 4;
        while (end < lots.length && end - i < capacity && lots[end] === 'house') end++;
      }
      const blockWidth = widths.slice(i, end).reduce((sum, w) => sum + w, 0) / total;
      const finish = start + blockWidth;
      const skew = end === lots.length ? 0 : between(-29, 29) / width;
      const endTop = finish + skew, endBottom = finish - skew;
      const upper = trace(t => map(streetTop + (endTop - streetTop) * t, r));
      const lower = trace(t => map(endBottom + (streetBottom - endBottom) * t, r + 1));
      blocks.push({ kind, d: `M${upper} L${lower} Z` });
      sideStreet(endTop, endBottom);

      const firstFacesStreet = random() < .5;
      const homes = [];
      let left = start;
      for (let j = i; j < end; j++) {
        const lotWidth = widths[j] / total;
        const u = left + lotWidth * between(.46, .54);
        const front = (j - i) % 3 === (firstFacesStreet ? 0 : 1);
        const v = kind === 'house' ? (front ? between(.30, .42) : between(.57, .72)) : .5;
        const [x, y] = map(u, r + v);
        if (kind === 'house') {
          const urban = points.length % 2 === 0;
          const types = urban ? ['apartment', 'townhouse', 'modern'] : ['cottage', 'bungalow', 'cabin'];
          let position = [x, y], best = -1;
          for (const [du, dv] of [[0, 0], [.14, 0], [-.14, 0], [0, .12], [0, -.12], [.14, .1], [-.14, -.1]]) {
            const [px, py] = map(u + du * lotWidth, r + Math.max(.27, Math.min(.76, v + dv)));
            const room = Math.min(...points.map(p => Math.hypot((px - p.x) / 108, (py - p.y) / 130)));
            if (room > best) {
              position = [px, py];
              best = room;
            }
            if (room >= 1) break;
          }
          const home = { x: position[0], y: position[1], building: types[Math.floor(random() * types.length)] };
          points.push(home);
          homes.push(home);
          if (end - i === 1 || j === end - 1) {
            const [yardX, yardY] = map(u, r + (front ? .77 : .22));
            places.push({ kind: 'garden', x: yardX, y: yardY, flip: random() < .5 });
          }
        } else {
          const candidates = kind === 'square' ? [.5, .32, .68, .24, .76]
            .flatMap(depth => [0, -.12, .12].map(offset => map(u + lotWidth * offset, r + depth))) : undefined;
          places.push({ kind, x, y, candidates });
          if (kind === 'square') {
            const [cx, cy] = map(u, highStreet);
            const [ax, ay] = map(u + .01, highStreet);
            places.push({ kind: 'crossing', x: cx, y: cy, angle: Math.atan2(ay - cy, ax - cx) * 180 / Math.PI });
          }
        }
        left += lotWidth;
      }
      if (homes.length > 1) {
        const [x, y] = map(start + blockWidth * .48, r + .48);
        const walks = homes.map(p => `M${x},${y} Q${p.x},${y} ${p.x},${p.y}`).join(' ');
        places.push({ kind: 'court', x, y, walks });
      }
      start = finish;
      streetTop = endTop;
      streetBottom = endBottom;
      i = end;
    }
  }
  const xs = outline.map(([x]) => x), ys = outline.map(([, y]) => y);
  const bounds = [{ x: Math.min(...xs), y: Math.min(...ys) }, { x: Math.max(...xs), y: Math.max(...ys) }];
  return { points, city: { seed, roads, blocks, places, bounds } };
}
