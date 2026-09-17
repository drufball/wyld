import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  cameraOffset,
  cameraTarget,
  ELEVATION,
  orthoFrustum,
  pickBodyFromNdc,
  pickTileFromNdc,
  projectTile,
  screenCentre,
  shadowCameraHalfExtent,
} from './camera.js';
const inside = (cols: number, rows: number, screen = { x: 0, y: 0 }) => {
  const f = orthoFrustum(cols, rows),
    t = screenCentre(screen, cols, rows);
  for (let y = screen.y * rows; y <= (screen.y + 1) * rows; y++)
    for (let x = screen.x * cols; x <= (screen.x + 1) * cols; x++) {
      const p = projectTile(x, y, 0, t, f);
      expect(Math.abs(p.ndcX)).toBeLessThanOrEqual(1);
      expect(Math.abs(p.ndcY)).toBeLessThanOrEqual(1);
    }
};
describe('camera maths', () => {
  it('projects every tile of the current screen inside the viewport', () => {
    inside(20, 15);
    inside(11, 22, { x: 4, y: 7 });
  });
  it('keeps the whole tile rectangle visible at any canvas aspect ratio', () => {
    const expected = orthoFrustum(20, 15);
    for (const [w, h] of [
      [1280, 720],
      [375, 812],
      [2000, 400],
    ]) {
      expect(w! / h!).toBeGreaterThan(0);
      expect(orthoFrustum(20, 15)).toEqual(expected);
      inside(20, 15);
    }
  });
  it('places the camera south of and above its target', () => {
    const o = cameraOffset(200);
    expect(o.x).toBe(0);
    expect(o.y).toBeGreaterThan(0);
    expect(o.z).toBeGreaterThan(0);
  });
  it('foreshortens depth but not width', () => {
    const f = orthoFrustum(20, 15),
      t = { x: 10, z: 7.5 },
      a = projectTile(1, 1, 0, t, f),
      x = projectTile(2, 1, 0, t, f),
      z = projectTile(1, 2, 0, t, f);
    expect(x.ndcX - a.ndcX).toBeCloseTo(1 / f.halfWidth);
    expect(Math.abs(z.ndcY - a.ndcY)).toBeCloseTo(Math.sin(ELEVATION) / f.halfHeight);
  });
  it('slides the camera from the old screen centre to the new one', () => {
    const s = { from: { sx: 0, sy: 0 }, to: { sx: 1, sy: 0 }, progress: 0 };
    expect(cameraTarget({ x: 0, y: 0 }, s, 20, 15).x).toBe(10);
    s.progress = 0.5;
    expect(cameraTarget({ x: 0, y: 0 }, s, 20, 15).x).toBe(20);
    s.progress = 1;
    expect(cameraTarget({ x: 0, y: 0 }, s, 20, 15).x).toBe(30);
  });
  it('picks back the tile that a projected tile centre came from', () => {
    const f = orthoFrustum(20, 15),
      t = { x: 10, z: 7.5 };
    for (let y = 0; y < 15; y++)
      for (let x = 0; x < 20; x++) {
        const p = projectTile(x + 0.5, y + 0.5, 0, t, f);
        expect(pickTileFromNdc(p.ndcX, p.ndcY, t, f)).toEqual({ tx: x, ty: y });
      }
  });
  it('agrees with a real THREE.OrthographicCamera', () => {
    const t = { x: 30, z: 22.5 },
      f = orthoFrustum(20, 15),
      o = cameraOffset(200),
      c = new THREE.OrthographicCamera(
        -f.halfWidth,
        f.halfWidth,
        f.halfHeight,
        -f.halfHeight,
        1,
        400,
      );
    c.position.set(t.x + o.x, o.y, t.z + o.z);
    c.up.set(0, 1, 0);
    c.lookAt(t.x, 0, t.z);
    c.updateProjectionMatrix();
    c.updateMatrixWorld();
    for (const [x, y, z] of [
      [22, 0, 18],
      [35, 0, 27],
    ]) {
      const actual = new THREE.Vector3(x!, y!, z!).project(c),
        expected = projectTile(x!, z!, y!, t, f);
      expect(actual.x).toBeCloseTo(expected.ndcX, 6);
      expect(actual.y).toBeCloseTo(expected.ndcY, 6);
    }
  });
  it('sizes the shadow camera from the screen diagonal', () => {
    for (const [cols, rows] of [
      [20, 15],
      [11, 22],
    ])
      expect(shadowCameraHalfExtent(cols!, rows!)).toBeGreaterThanOrEqual(
        Math.hypot(cols!, rows!) / 2,
      );
  });
  it('a tap on the top of a tall body picks the body, not the tile behind it', () => {
    const f = orthoFrustum(20, 15),
      t = { x: 10, z: 7.5 },
      body = { key: 'tall', tileX: 5.5, tileY: 5.5, heightTiles: 1.6, widthTiles: 1 },
      point = projectTile(body.tileX, body.tileY, 1.4, t, f);
    expect(pickTileFromNdc(point.ndcX, point.ndcY, t, f).ty).toBeLessThan(5);
    expect(pickBodyFromNdc(point.ndcX, point.ndcY, [body], t, f, { x: 0, y: 0 })).toBe('tall');
  });
  it('a tap on empty ground picks no body', () => {
    expect(
      pickBodyFromNdc(0.9, 0.9, [], { x: 10, z: 7.5 }, orthoFrustum(20, 15), {
        x: 0,
        y: 0,
      }),
    ).toBeNull();
  });
  it('the nearer body wins when two overlap', () => {
    const f = orthoFrustum(20, 15),
      t = { x: 10, z: 7.5 },
      bodies = [
        { key: 'far', tileX: 5.5, tileY: 5, heightTiles: 2, widthTiles: 1 },
        { key: 'near', tileX: 5.5, tileY: 6, heightTiles: 2, widthTiles: 1 },
      ],
      point = projectTile(5.5, 6, 0.5, t, f);
    expect(pickBodyFromNdc(point.ndcX, point.ndcY, bodies, t, f, { x: 0, y: 0 })).toBe('near');
  });
});
