import React from 'react';

export function DistrictCable({ d, start, end, control, active, selected, zoom, decision }) {
  const dx = end.x - start.x, dy = end.y - start.y;
  const span = Math.hypot(dx, dy);
  const spaced = span > 35;
  const shiftX = spaced ? -dy / span * 2.65 : 0;
  const shiftY = spaced ? dx / span * 2.65 : 0;
  const poles = span < 38 || zoom < .42 ? [] : span > 175 ? [.22, .78] : [.23];
  return <g className={`district-cable ${active ? 'live' : ''} ${selected ? 'picked' : ''} ${decision || ''}`} aria-hidden="true" pointerEvents="none">
    <path className="district-cable-bed" d={d} />
    <path className="district-wire" d={d} transform={`translate(${shiftX} ${shiftY})`} />
    {spaced && <path className="district-wire" d={d} transform={`translate(${-shiftX} ${-shiftY})`} />}
    {poles.map(t => {
      const before = (1 - t) ** 2, between = 2 * (1 - t) * t, after = t ** 2;
      const x = start.x * before + control.x * between + end.x * after;
      const y = start.y * before + control.y * between + end.y * after;
      return <g key={t} transform={`translate(${x} ${y})`} className="district-pole">
        <ellipse cy="14" rx="10" ry="3.7" />
        <path className="district-pole-mast" d="M-6 14-2-5h4l4 19ZM-2 0l6 8m-2-8-6 8M-10-4h20m-14-4h8" />
        <path className="district-pole-tips" d="M-8-4v-4m16 4v-4" />
      </g>;
    })}
  </g>;
}
