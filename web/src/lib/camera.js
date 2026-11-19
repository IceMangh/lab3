export const MIN_ZOOM = 0.15;
export const MAX_ZOOM = 3;
export const WORLD_LIMIT = 100000;
export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const boundCoordinate = value => clamp(value, -WORLD_LIMIT, WORLD_LIMIT);

export function screenToWorld(point, camera, viewport) {
  return {
    x: camera.x + (point.x - viewport.width / 2) / camera.zoom,
    y: camera.y + (point.y - viewport.height / 2) / camera.zoom,
  };
}

export function zoomAt(camera, point, viewport, factor) {
  const anchor = screenToWorld(point, camera, viewport);
  const zoom = clamp(camera.zoom * factor, MIN_ZOOM, MAX_ZOOM);
  return {
    x: anchor.x - (point.x - viewport.width / 2) / zoom,
    y: anchor.y - (point.y - viewport.height / 2) / zoom,
    zoom,
  };
}

export function panFrom(camera, delta) {
  return { ...camera, x: camera.x - delta.x / camera.zoom, y: camera.y - delta.y / camera.zoom };
}

export function fitCamera(nodes, viewport) {
  if (!nodes.length) return { x: 500, y: 250, zoom: 1 };
  const minX = Math.min(...nodes.map(node => node.x)) - 65;
  const maxX = Math.max(...nodes.map(node => node.x)) + 65;
  const minY = Math.min(...nodes.map(node => node.y)) - 90;
  const maxY = Math.max(...nodes.map(node => node.y)) + 65;
  return {
    x: (minX + maxX) / 2, y: (minY + maxY) / 2,
    zoom: clamp(Math.min((viewport.width - 100) / (maxX - minX), (viewport.height - 100) / (maxY - minY)), MIN_ZOOM, 1.4),
  };
}

// Смещение узла фоновой сетки, в пикселях экрана.
export function meshDisplacement(x, y, pointer) {
  if (!pointer.active) return { x: 0, y: 0 };
  const dx = x - pointer.x, dy = y - pointer.y;
  const distance = Math.hypot(dx, dy), radius = 180;
  if (distance >= radius || distance < 0.1) return { x: 0, y: 0 };
  const force = (1 - distance / radius) ** 2 * 32;
  return { x: dx / distance * force, y: dy / distance * force };
}
