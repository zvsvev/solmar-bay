// Solmar Bay — the city itself: a road grid, the blocks between the roads filled with
// buildings, a park, a beach and pier on the south edge, and the named landmarks the
// missions and the minimap point at. Everything is generated from the seed, so the city
// is identical every time the same seed is used.
import { AVENUES, BEACH_Y, ROAD_W, STREETS, WORLD_H, WORLD_W } from './config.js';

const ROOF_COLORS = ['#b08968', '#9c7a5e', '#7d8a99', '#a87f6a', '#6e7f80', '#b59a7a', '#8a6f5c'];
const ROOF_TRIMS = ['#6b4f3a', '#5d6b7a', '#4f5a52', '#7a5c44'];

function roadRects() {
  const rects = [];
  for (const x of AVENUES) rects.push({ x: x - ROAD_W / 2, y: 0, w: ROAD_W, h: BEACH_Y, vertical: true });
  for (const y of STREETS) rects.push({ x: 0, y: y - ROAD_W / 2, w: WORLD_W, h: ROAD_W, vertical: false });
  return rects;
}

export function createCity(rng) {
  const buildings = [];
  // One building per block, inset from the roads; a few blocks stay open as plazas.
  for (let a = 0; a < AVENUES.length - 1; a += 1) {
    for (let s = 0; s < STREETS.length - 1; s += 1) {
      const x0 = AVENUES[a] + ROAD_W / 2 + 14;
      const y0 = STREETS[s] + ROAD_W / 2 + 14;
      const x1 = AVENUES[a + 1] - ROAD_W / 2 - 14;
      const y1 = STREETS[s + 1] - ROAD_W / 2 - 14;
      if (rng.chance(0.14)) continue; // open plaza
      const w = rng.range((x1 - x0) * 0.55, x1 - x0);
      const h = rng.range((y1 - y0) * 0.55, y1 - y0);
      const x = x0 + rng.range(0, x1 - x0 - w);
      const y = y0 + rng.range(0, y1 - y0 - h);
      buildings.push({
        x, y, w, h,
        roof: rng.pick(ROOF_COLORS),
        trim: rng.pick(ROOF_TRIMS),
        height: rng.int(1, 3),
      });
    }
  }
  // The park fills the block between avenue 3 and 4, street 3 and 4.
  const park = {
    x: AVENUES[3] + ROAD_W / 2 + 10,
    y: STREETS[3] + ROAD_W / 2 + 10,
    w: AVENUES[4] - AVENUES[3] - ROAD_W - 20,
    h: STREETS[4] - STREETS[3] - ROAD_W - 20,
  };
  // Landmarks: fixed road-side spots the missions use.
  const landmarks = {
    garage: { x: AVENUES[1], y: STREETS[1] + 120, label: "Rico's Garage" },
    bank: { x: AVENUES[4], y: STREETS[2] - 110, label: 'Bayfront Bank' },
    hospital: { x: AVENUES[6], y: STREETS[5] + 120, label: 'Solmar General' },
    policeStation: { x: AVENUES[2], y: STREETS[4] - 110, label: 'Solmar PD' },
    pier: { x: AVENUES[5], y: BEACH_Y + 70, label: 'Sunset Pier' },
    motel: { x: AVENUES[7] - 60, y: STREETS[6] + 120, label: 'Palms Motel' },
    safehouse: { x: AVENUES[0] + 40, y: STREETS[6] - 110, label: 'Safehouse' },
    bar: { x: AVENUES[3], y: STREETS[0] + 120, label: "Rico's Bar" },
  };
  // Keep the landmark spots clear of buildings.
  for (const key of Object.keys(landmarks)) {
    const p = landmarks[key];
    for (let i = buildings.length - 1; i >= 0; i -= 1) {
      const b = buildings[i];
      if (p.x > b.x - 70 && p.x < b.x + b.w + 70 && p.y > b.y - 70 && p.y < b.y + b.h + 70) buildings.splice(i, 1);
    }
  }
  return { buildings, park, landmarks, roads: roadRects() };
}

/** True when the point is on a road (or on the beach road that runs along the sand). */
export function isOnRoad(city, x, y) {
  if (y >= BEACH_Y) return y < BEACH_Y + ROAD_W;
  for (const r of city.roads) {
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return true;
  }
  return false;
}

/** The building that contains the point, or null. */
export function buildingAt(city, x, y) {
  for (const b of city.buildings) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
  }
  return null;
}

/** Push a circle out of every building it overlaps; returns true when it was pushed. */
export function resolveBuildingCollision(city, body, radius) {
  let pushed = false;
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(body.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(body.y, b.y + b.h));
    const dx = body.x - cx;
    const dy = body.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < radius * radius) {
      const d = Math.sqrt(d2) || 0.001;
      const push = radius - d;
      body.x += (dx / d) * push;
      body.y += (dy / d) * push;
      pushed = true;
    }
  }
  return pushed;
}

/** A random point on a road, for spawning traffic and pedestrians. */
export function randomRoadPoint(city, rng) {
  if (rng.chance(0.5)) {
    const x = rng.pick(AVENUES) + rng.range(-ROAD_W / 4, ROAD_W / 4);
    return { x, y: rng.range(ROAD_W, BEACH_Y - ROAD_W), vertical: true };
  }
  const y = rng.pick(STREETS) + rng.range(-ROAD_W / 4, ROAD_W / 4);
  return { x: rng.range(ROAD_W, WORLD_W - ROAD_W), y, vertical: false };
}

/** The nearest road centre-line point to (x, y), used by the autopilot. */
export function nearestRoadPoint(x, y) {
  let bestX = AVENUES[0];
  let bestD = Infinity;
  for (const a of AVENUES) {
    const d = Math.abs(a - x);
    if (d < bestD) { bestD = d; bestX = a; }
  }
  let bestY = STREETS[0];
  bestD = Infinity;
  for (const s of STREETS) {
    const d = Math.abs(s - y);
    if (d < bestD) { bestD = d; bestY = s; }
  }
  return Math.abs(bestX - x) < Math.abs(bestY - y) ? { x: bestX, y } : { x, y: bestY };
}
