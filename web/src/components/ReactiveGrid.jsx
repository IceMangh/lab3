import React, { useEffect, useRef } from 'react';
import { meshDisplacement } from '../lib/camera';

export function ReactiveGrid({ viewportRef, camera, size, enabled, theme = 'dark' }) {
  const canvasRef = useRef(null);
  const pointer = useRef({ x: 0, y: 0, active: false });

  useEffect(() => {
    if (!enabled) return;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return;
    const viewport = viewportRef.current;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = size.width, height = size.height;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.globalAlpha = .85;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const light = theme === 'light';
    const colors = light
      ? { minor: '#e9e9e9', major: '#cfcfcf', dot: '#a4a4a4', ink: '0,0,0' }
      : { minor: '#242424', major: '#404040', dot: '#666666', ink: '255,255,255' };
    const worldStep = 40 * 2 ** Math.round(Math.log2(1 / camera.zoom));
    const spacing = worldStep * camera.zoom;
    const firstColumn = Math.floor((camera.x - width / 2 / camera.zoom) / worldStep) - 1;
    const firstRow = Math.floor((camera.y - height / 2 / camera.zoom) / worldStep) - 1;
    const offsetX = (firstColumn * worldStep - camera.x) * camera.zoom + width / 2;
    const offsetY = (firstRow * worldStep - camera.y) * camera.zoom + height / 2;
    const columns = Math.ceil(width / spacing) + 3, rows = Math.ceil(height / spacing) + 3;
    const points = Array.from({ length: rows }, (_, row) => Array.from({ length: columns }, (_, col) => ({
      bx: offsetX + col * spacing, by: offsetY + row * spacing, dx: 0, dy: 0, vx: 0, vy: 0,
      majorX: (firstColumn + col) % 4 === 0, majorY: (firstRow + row) % 4 === 0,
    })));
    let frame = 0, disposed = false;

    function draw() {
      frame = 0;
      if (disposed) return;
      let moving = false;
      context.clearRect(0, 0, width, height);
      const cursor = { ...pointer.current, active: pointer.current.active && !motion.matches };
      if (cursor.active) {
        const lens = context.createRadialGradient(cursor.x, cursor.y, 0, cursor.x, cursor.y, 240);
        lens.addColorStop(0, `rgba(${colors.ink},${light ? '.025' : '.045'})`);
        lens.addColorStop(1, `rgba(${colors.ink},0)`);
        context.fillStyle = lens;
        context.fillRect(0, 0, width, height);
      }
      for (const row of points) for (const point of row) {
        if (motion.matches) { point.dx = point.dy = point.vx = point.vy = 0; continue; }
        const target = meshDisplacement(point.bx, point.by, cursor);
        point.vx = (point.vx + (target.x - point.dx) * .12) * .72;
        point.vy = (point.vy + (target.y - point.dy) * .12) * .72;
        point.dx += point.vx; point.dy += point.vy;
        if (Math.abs(point.vx) + Math.abs(point.vy) + Math.abs(target.x - point.dx) + Math.abs(target.y - point.dy) > .05) moving = true;
      }
      for (const major of [false, true]) {
        context.beginPath();
        for (const row of points) {
          if (row[0].majorY !== major) continue;
          row.forEach((p, index) => {
            if (!index) context.moveTo(p.bx + p.dx, p.by + p.dy);
            else context.lineTo(p.bx + p.dx, p.by + p.dy);
          });
        }
        for (let col = 0; col < columns; col++) {
          if (points[0][col].majorX !== major) continue;
          for (let row = 0; row < rows; row++) {
            const p = points[row][col];
            if (!row) context.moveTo(p.bx + p.dx, p.by + p.dy);
            else context.lineTo(p.bx + p.dx, p.by + p.dy);
          }
        }
        context.strokeStyle = major ? colors.major : colors.minor;
        context.lineWidth = major ? .8 : .5;
        context.stroke();
      }
      for (const row of points) for (const p of row) {
        const distance = cursor.active ? Math.hypot(p.bx - cursor.x, p.by - cursor.y) : 999;
        const x = p.bx + p.dx, y = p.by + p.dy;
        if (p.majorX && p.majorY) {
          context.beginPath(); context.moveTo(x - 2.5, y); context.lineTo(x + 2.5, y);
          context.moveTo(x, y - 2.5); context.lineTo(x, y + 2.5);
          context.strokeStyle = colors.dot; context.lineWidth = .75; context.stroke();
        } else {
          context.fillStyle = distance < 180 ? `rgba(${colors.ink},${.15 + (1 - distance / 180) * .4})` : colors.dot;
          context.beginPath(); context.arc(x, y, distance < 180 ? 1 : .55, 0, Math.PI * 2); context.fill();
        }
      }
      if (cursor.active) {
        const accent = (a, b) => {
          const distance = Math.hypot((a.bx + b.bx) / 2 - cursor.x, (a.by + b.by) / 2 - cursor.y);
          if (distance > 180) return;
          context.beginPath(); context.moveTo(a.bx + a.dx, a.by + a.dy); context.lineTo(b.bx + b.dx, b.by + b.dy);
          context.strokeStyle = `rgba(${colors.ink},${.1 + (1 - distance / 180) * (light ? .15 : .3)})`;
          context.lineWidth = .85; context.stroke();
        };
        for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
          if (col + 1 < columns) accent(points[row][col], points[row][col + 1]);
          if (row + 1 < rows) accent(points[row][col], points[row + 1][col]);
        }
      }
      if (moving) frame = requestAnimationFrame(draw);
    }

    function schedule() { if (!frame && !disposed) frame = requestAnimationFrame(draw); }
    function move(event) {
      if (event.pointerType === 'touch' || motion.matches) return;
      const rect = viewport.getBoundingClientRect();
      pointer.current = { x: event.clientX - rect.left, y: event.clientY - rect.top, active: true };
      schedule();
    }
    function leave() { pointer.current.active = false; schedule(); }
    viewport.addEventListener('pointermove', move);
    viewport.addEventListener('pointerleave', leave);
    motion.addEventListener('change', schedule);
    draw();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      viewport.removeEventListener('pointermove', move);
      viewport.removeEventListener('pointerleave', leave);
      motion.removeEventListener('change', schedule);
    };
  }, [viewportRef, camera.x, camera.y, camera.zoom, size.width, size.height, enabled, theme]);

  return enabled ? <canvas className="reactive-grid" ref={canvasRef} aria-hidden="true" /> : null;
}
