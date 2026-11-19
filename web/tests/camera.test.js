import test from 'node:test';
import assert from 'node:assert/strict';
import { fitCamera, meshDisplacement, panFrom, screenToWorld, zoomAt, MIN_ZOOM, MAX_ZOOM } from '../src/lib/camera.js';

const viewport = { width: 1200, height: 800 };
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);

test('wheel zoom preserves the world point under the cursor', () => {
  const camera = { x: -250, y: 700, zoom: .7 };
  for (const point of [{ x: 0, y: 0 }, { x: 850, y: 270 }, { x: 1200, y: 800 }]) {
    const before = screenToWorld(point, camera, viewport);
    const next = zoomAt(camera, point, viewport, 1.8);
    const after = screenToWorld(point, next, viewport);
    near(before.x, after.x); near(before.y, after.y);
  }
});

test('zoom limits keep cursor anchoring consistent', () => {
  const point = { x: 150, y: 650 }, camera = { x: 500, y: 250, zoom: 1 };
  for (const [factor, expected] of [[.0001, MIN_ZOOM], [1000, MAX_ZOOM]]) {
    const next = zoomAt(camera, point, viewport, factor);
    assert.equal(next.zoom, expected);
    near(screenToWorld(point, next, viewport).x, screenToWorld(point, camera, viewport).x);
  }
});

test('panning follows pixel distance at the current zoom', () => {
  const camera = { x: 500, y: 250, zoom: 2 };
  assert.deepEqual(panFrom(camera, { x: 100, y: -60 }), { x: 450, y: 280, zoom: 2 });
  assert.deepEqual(camera, { x: 500, y: 250, zoom: 2 });
});

test('fit includes graphs outside the original canvas without changing positions', () => {
  const nodes = [{ x: -700, y: -400 }, { x: 1700, y: 1200 }];
  const camera = fitCamera(nodes, viewport);
  for (const node of nodes) {
    const x = (node.x - camera.x) * camera.zoom + viewport.width / 2;
    const y = (node.y - camera.y) * camera.zoom + viewport.height / 2;
    assert.ok(x > 30 && x < viewport.width - 30);
    assert.ok(y > 30 && y < viewport.height - 30);
  }
  assert.deepEqual(nodes[0], { x: -700, y: -400 });
});

test('fit handles empty and single-node graphs', () => {
  assert.deepEqual(fitCamera([], viewport), { x: 500, y: 250, zoom: 1 });
  const camera = fitCamera([{ x: 10, y: 20 }], viewport);
  assert.ok(Number.isFinite(camera.zoom) && camera.zoom <= 1.4);
});

test('mesh deforms locally away from the pointer and rests without it', () => {
  const pointer = { x: 100, y: 100, active: true };
  const right = meshDisplacement(150, 100, pointer);
  assert.ok(right.x > 0 && right.x < 32); near(right.y, 0);
  const left = meshDisplacement(50, 100, pointer);
  near(left.x, -right.x);
  assert.deepEqual(meshDisplacement(400, 100, pointer), { x: 0, y: 0 });
  assert.deepEqual(meshDisplacement(100, 100, pointer), { x: 0, y: 0 });
  assert.deepEqual(meshDisplacement(150, 100, { ...pointer, active: false }), { x: 0, y: 0 });
});
