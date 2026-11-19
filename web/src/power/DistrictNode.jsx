import React from 'react';

const houseTypes = [
  { width: 43, depth: 24, height: 24, roof: 17, floors: 1, tone: 'cottage' },
  { width: 47, depth: 25, height: 46, roof: 0, floors: 3, tone: 'modern' },
  { width: 34, depth: 24, height: 45, roof: 12, floors: 3, tone: 'townhouse' },
  { width: 52, depth: 20, height: 24, roof: 10, floors: 1, tone: 'bungalow' },
  { width: 36, depth: 22, height: 29, roof: 20, floors: 2, tone: 'cabin' },
  { width: 46, depth: 25, height: 60, roof: 0, floors: 5, tone: 'apartment' },
];

function Building({ type, station }) {
  const { width, depth, height, roof, floors, tone } = type;
  const centerX = width / 2 + depth * .36;
  const centerY = 12 + (depth * .43 - width * .35) / 2;
  const point = (x, y, z) => [
    (x + z * .72 - centerX).toFixed(1),
    (centerY + x * .35 - z * .43 - y).toFixed(1),
  ].join(',');
  const face = vertices => vertices.map(vertex => point(...vertex)).join(' ');
  const front = (left, bottom, w, h) => face([[left, bottom, 0], [left + w, bottom, 0],
    [left + w, bottom + h, 0], [left, bottom + h, 0]]);
  const side = (back, bottom, w, h) => face([[width, bottom, back], [width, bottom, back + w],
    [width, bottom + h, back + w], [width, bottom + h, back]]);
  const roofPoints = roof ? [[width / 2, height + roof, 0]] : [];
  const houseFront = [[0, 0, 0], [0, height, 0], ...roofPoints, [width, height, 0], [width, 0, 0]];
  const slab = station ? 9 : 5;
  const foot = [[-slab, -2, -slab], [width + slab, -2, -slab],
    [width + slab, -2, depth + slab], [-slab, -2, depth + slab]];

  return <g className={`district-building ${tone}`} aria-hidden="true">
    <polygon className="district-block-shadow" points={face(foot)} transform="translate(4 4)" />
    <polygon className="district-building-base" points={face(foot)} />
    <polygon className="district-building-side" points={side(0, 0, depth, height)} />
    <polygon className="district-building-front" points={face(houseFront)} />
    {roof ? <>
      <polygon className="district-roof-back" points={face([[0, height, 0], [0, height, depth],
        [width / 2, height + roof, depth], [width / 2, height + roof, 0]])} />
      <polygon className="district-roof" points={face([[width / 2, height + roof, 0], [width / 2, height + roof, depth],
        [width, height, depth], [width, height, 0]])} />
      <path className="district-roof-seam"
        d={`M${point(width * .7, height + roof * .6, 0)}L${point(width * .7, height + roof * .6, depth)}`} />
    </> : <>
      <polygon className="district-roof" points={face([[0, height, 0], [width, height, 0], [width, height, depth], [0, height, depth]])} />
      <polygon className="district-roof-inset" points={face([[4, height, 4], [width - 4, height, 4],
        [width - 4, height, depth - 4], [4, height, depth - 4]])} />
    </>}
    {station ? <>
      <g className="district-transformer-bolt" transform={`translate(${point(width / 2, height * .53, 0)})`}>
        <path d="M2-11-8 2h7l-2 10L8-2H1Z" />
      </g>
      {[5, 11, 17].map(z => <polygon key={z} className="district-transformer-vent" points={side(z, 6, 3, 12)} />)}
      {[12, 26, 40].map(x => <g key={x} className="district-terminal" transform={`translate(${point(x, height, depth * .58)})`}>
        <path d="M0 0v-15m-3 4h6m-6 4h6" /><circle cy="-16" r="2.4" />
      </g>)}
    </> : <>
      <polygon className="district-door" points={front(width / 2 - 3.5, 0, 7, 12)} />
      {Array.from({ length: floors }, (_, floor) => {
        const y = 9 + floor * 10.5;
        return <g key={floor} className="district-windows">
          <polygon points={front(5, y, 7, 6)} />
          <polygon points={front(width - 12, y, 7, 6)} />
          {tone === 'apartment' && <polygon points={front(width / 2 - 3.5, y + 2, 7, 4)} />}
          <polygon points={side(5, y, depth - 11, 6)} />
        </g>;
      })}
    </>}
  </g>;
}

const substation = { width: 53, depth: 26, height: 25, roof: 0, tone: 'transformer' };

export function DistrictNode({ node, energized, unreachable }) {
  const station = node.id === 0;
  const house = houseTypes.find(type => type.tone === node.building) || houseTypes[(node.id - 1) % houseTypes.length];
  const name = node.name.trim() || (station ? 'S' : String(node.id));
  const label = name.length > 12 ? name.slice(0, 11) + '…' : name;
  const state = station ? 'station' : unreachable ? 'unreachable' : energized ? 'energized' : '';
  return <g className={`district-marker ${state}`}>
    <Building station={station} type={station ? substation : house} />
    <text x="-20" y="34">{label}</text>
  </g>;
}
