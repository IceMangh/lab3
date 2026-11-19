import React, { memo } from 'react';

function Tree({ x, y, scale = 1 }) {
  return <g className="district-tree" transform={`translate(${x} ${y}) scale(${scale})`}>
    <ellipse className="district-tree-shadow" cx="3" cy="5" rx="12" ry="5" />
    <path className="district-tree-trunk" d="M0 4v-12" />
    <ellipse className="district-tree-crown" cx="0" cy="-8" rx="10" ry="10" />
    <path className="district-tree-light" d="M-6-9q0-5 5-6" />
  </g>;
}

function Bench({ x, y, angle = 0 }) {
  return <g className="district-bench" transform={`translate(${x} ${y}) rotate(${angle})`}>
    <path d="M-6-2v6m12-6v6M-9-2H9m-18 3H9" />
  </g>;
}

function CityPlace({ place }) {
  const { kind, x, y, flip } = place;
  if (kind === 'court') return <g className="district-court">
    <path className="district-court-walk" d={place.walks} />
    <g transform={`translate(${x} ${y})`}>
      <path className="district-court-patio" d="m-18-4 24-7 14 8-23 8z" />
      <Bench x={-8} y={0} angle={-15} /><Tree x={14} y={-3} scale={.72} />
    </g>
  </g>;
  return <g transform={`translate(${x} ${y})`}>
    {kind === 'crossing' && <g className="district-crossing" transform={`rotate(${place.angle})`}>
      <rect x="-11" y="-14" width="22" height="28" />
      <path d="M-7-9H7m-14 4.5H7M-7 0H7m-14 4.5H7m-14 4.5H7" />
    </g>}
    {kind === 'square' && <>
      <path className="district-square-paving" d="m-44-21 62-10 27 13 3 37-64 11-28-14z" />
      <path className="district-paving-joints" d="m-37-12 60-10m-45 42 61-10m-66-28 4 36m50-44 3 36" />
      <g className="district-fountain">
        <ellipse className="district-fountain-wall" cy="4" rx="17" ry="8" />
        <ellipse className="district-fountain-water" rx="17" ry="7" />
        <path d="M-5 1q1-13 5-5 4-8 6 4M0 1v-13" />
      </g>
      <Bench x={-28} y={8} angle={78} /><Bench x={31} y={-7} angle={78} />
      <Tree x={-32} y={-19} scale={.68} /><Tree x={33} y={15} scale={.68} />
    </>}
    {kind === 'park' && <>
      <path className="district-park-path" d="M-39 32Q-30 14-5 7T35-26" />
      <Tree x={-29} y={-10} scale={1.04} /><Tree x={-8} y={-23} scale={.8} />
      <Tree x={26} y={25} /><Bench x={9} y={9} angle={-24} />
    </>}
    {kind === 'garden' && <g transform={flip ? 'scale(-1 1)' : undefined}>
      <path className="district-garden-bed" d="m-24-4 20-5 11 6-20 5z" />
      <path className="district-yard-path" d="m-24 5 17 6 18-6" />
      <path className="district-hedge" d="m-25 0 3-7 17-3" />
      <Tree x={18} y={1} scale={.7} />
    </g>}
    {kind === 'vacant' && <g className="district-meadow">
      <path d="m-23 5 2-4 2 3m13-16 2-4 2 3m11 25 2-4 2 3m9-19 2-4 2 3" />
    </g>}
    {kind === 'utility' && <>
      <path className="district-service-yard" d="m-46-22 70-11 22 16-1 39-69 11-22-16z" />
      <path className="district-service-fence" d="m-46 13 1-37 68-11 22 15v36m-90-36v-8m24 4v-8m22 4v-8m24 5v-8m20 23v-8" />
    </>}
  </g>;
}

const roadWidths = { avenue: 26, lane: 14, side: 12, drive: 8 };

export const DistrictStreets = memo(function DistrictStreets({ city }) {
  return <g className="district-streets" aria-hidden="true" pointerEvents="none">
    {city.blocks.map(({ d, kind }, i) => <path key={i} d={d} className={`district-block ${kind}`} />)}
    {city.roads.map(({ d, kind }, i) =>
      <path key={i} className="district-road-kerb" d={d} strokeWidth={roadWidths[kind] + 4} />)}
    {city.roads.map(({ d, kind }, i) =>
      <path key={i} className="district-road" d={d} strokeWidth={roadWidths[kind]} />)}
    {city.roads.filter(road => road.kind === 'avenue').map(({ d }) =>
      <path key={d} className="district-road-marking" d={d} />)}
    {city.places.map((place, i) => <CityPlace key={i} place={place} />)}
  </g>;
});
