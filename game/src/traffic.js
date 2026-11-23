// Traffic and pedestrians: cars cruise the road grid in lanes, turn at intersections,
// brake for the car ahead; pedestrians stroll the sidewalks and flee from gunfire and
// speeding cars. Parked cars double as the rides the player steals.
import { AVENUES, CAR_H, CAR_MAX_SPEED, CAR_W, ROAD_W, STREETS, WORLD_H, WORLD_W } from './config.js';
import { CAR_COLORS, PED_SHIRTS } from './config.js';
import { buildingAt, randomRoadPoint } from './city.js';

const PED_SPEED = 52;
const TRAFFIC_SPEED = 150;

export function createTraffic(city, rng) {
  const cars = [];
  const peds = [];
  let pedId = 0;

  function spawnCar(parked) {
    const p = randomRoadPoint(city, rng);
    const angle = p.vertical ? (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (rng.chance(0.5) ? 0 : Math.PI);
    // Parked cars sit half on the road's edge, facing along it.
    const car = {
      x: parked ? p.x + (p.vertical ? ROAD_W / 2 - 14 : 0) : p.x,
      y: parked ? p.y : p.y + (p.vertical ? 0 : ROAD_W / 2 - 14),
      angle,
      speed: parked ? 0 : rng.range(TRAFFIC_SPEED * 0.7, TRAFFIC_SPEED * 1.15),
      color: rng.pick(CAR_COLORS),
      parked: !!parked,
      isPolice: false,
      isPlayer: false,
      brake: 0,
    };
    if (buildingAt(city, car.x, car.y)) return;
    cars.push(car);
    return car;
  }

  function spawnPed() {
    const p = randomRoadPoint(city, rng);
    const side = rng.chance(0.5) ? -1 : 1;
    const ped = {
      id: pedId += 1,
      x: p.x + (p.vertical ? side * (ROAD_W / 2 + 10) : 0),
      y: p.y + (p.vertical ? 0 : side * (ROAD_W / 2 + 10)),
      angle: rng.range(0, Math.PI * 2),
      speed: rng.range(PED_SPEED * 0.7, PED_SPEED * 1.3),
      shirt: rng.pick(PED_SHIRTS),
      state: 'walk',
      fleeX: 0,
      fleeY: 0,
      timer: rng.range(2, 6),
      health: 100,
    };
    peds.push(ped);
    return ped;
  }

  function populate() {
    for (let i = 0; i < 26; i += 1) spawnCar(false);
    for (let i = 0; i < 14; i += 1) spawnCar(true);
    for (let i = 0; i < 34; i += 1) spawnPed();
  }

  function nearestCar(x, y, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const car of cars) {
      if (car.isPlayer) continue;
      const d = Math.hypot(car.x - x, car.y - y);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  function carAhead(car, dist) {
    // A car in the same lane, ahead of this one: parked cars at the road's edge and
    // cars in the next lane over do not count, or traffic jams behind parked cars.
    const fx = Math.cos(car.angle);
    const fy = Math.sin(car.angle);
    for (const other of cars) {
      if (other === car || other.parked) continue;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const along = dx * fx + dy * fy;
      const lat = -dx * fy + dy * fx;
      if (along > 0 && along < dist + 30 && Math.abs(lat) < 26) return true;
    }
    return false;
  }

  function stepCar(car, dt) {
    if (car.parked || car.isPlayer) return;
    // Slow for the car ahead, then cruise; at an intersection, sometimes turn.
    const target = carAhead(car, 46) ? 0 : car.speed;
    car.speed += (target - car.speed) * Math.min(1, dt * 2);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    const nearV = AVENUES.find((a) => Math.abs(car.x - a) < 8);
    const nearH = STREETS.find((s) => Math.abs(car.y - s) < 8);
    if (nearV !== undefined && nearH !== undefined && rng.chance(dt * 0.9)) {
      // Turn onto the cross road.
      car.angle = Math.abs(Math.cos(car.angle)) > 0.5
        ? (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2)
        : (rng.chance(0.5) ? 0 : Math.PI);
    }
    // Wrap around the city edges so traffic never runs out.
    if (car.x < -60) car.x = WORLD_W + 40;
    if (car.x > WORLD_W + 60) car.x = -40;
    if (car.y < -60) car.y = WORLD_H + 40;
    if (car.y > WORLD_H + 60) car.y = -40;
  }

  function stepPed(ped, dt, danger) {
    ped.timer -= dt;
    if (danger) {
      ped.state = 'flee';
      ped.timer = 1.2;
      const dx = ped.x - danger.x;
      const dy = ped.y - danger.y;
      const d = Math.hypot(dx, dy) || 1;
      ped.angle = Math.atan2(dy / d, dx / d);
    }
    if (ped.state === 'flee') {
      // Keep running the way the danger sent them, even after it passes.
      ped.x += Math.cos(ped.angle) * PED_SPEED * 2.1 * dt;
      ped.y += Math.sin(ped.angle) * PED_SPEED * 2.1 * dt;
      if (ped.timer <= 0) ped.state = 'walk';
    } else {
      ped.x += Math.cos(ped.angle) * ped.speed * dt;
      ped.y += Math.sin(ped.angle) * ped.speed * dt;
      if (ped.timer <= 0) {
        ped.timer = rng.range(2, 6);
        ped.angle += rng.range(-1.2, 1.2);
      }
      // Stay on the sidewalks: drift back toward the nearest road edge.
      const onV = AVENUES.some((a) => Math.abs(ped.x - a) < ROAD_W / 2 + 26);
      const onH = STREETS.some((s) => Math.abs(ped.y - s) < ROAD_W / 2 + 26);
      if (!onV && !onH) {
        ped.angle = Math.atan2(
          (STREETS.reduce((b, s) => (Math.abs(s - ped.y) < Math.abs(b - ped.y) ? s : b), STREETS[0])) - ped.y,
          (AVENUES.reduce((b, a) => (Math.abs(a - ped.x) < Math.abs(b - ped.x) ? a : b), AVENUES[0])) - ped.x,
        );
      }
    }
    ped.x = Math.max(20, Math.min(WORLD_W - 20, ped.x));
    ped.y = Math.max(20, Math.min(WORLD_H - 20, ped.y));
    if (buildingAt(city, ped.x, ped.y)) {
      ped.angle += Math.PI / 2;
      ped.x -= Math.cos(ped.angle) * 4;
      ped.y -= Math.sin(ped.angle) * 4;
    }
  }

  return {
    cars,
    peds,
    populate,
    spawnCar,
    spawnPed,
    nearestCar,
    /** Remove a car from traffic (the player stole it, or it was wrecked). */
    takeCar(car) {
      const i = cars.indexOf(car);
      if (i >= 0) cars.splice(i, 1);
      return car;
    },
    step(dt, player, gunfireAt) {
      for (const car of cars) stepCar(car, dt);
      const danger = gunfireAt || (player.car && Math.abs(player.car.speed) > 300 ? { x: player.x, y: player.y } : null);
      for (const ped of peds) stepPed(ped, dt, danger);
      // Top the population back up as the player roams.
      if (cars.length < 30 && rng.chance(dt * 0.5)) spawnCar(false);
      if (peds.length < 30 && rng.chance(dt * 0.8)) spawnPed();
    },
  };
}

export { CAR_W, CAR_H };
