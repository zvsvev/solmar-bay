// The screenshot scenes behind ?shot=cover|mission|chase|start. Each one stages a real
// game state — a car, a wanted level, an active mission — then plays the real rules
// forward for a fixed number of steps with a simple driving autopilot, so the frame is
// what a short game really looks like and the same seed always gives the same frame.
import { AVENUES, STEP } from './config.js';
import { nearestRoadPoint } from './city.js';

const SAMPLE = STEP;

/** Keys that steer the car toward (tx, ty) and keep the throttle open. */
function driveKeys(world) {
  const p = world.player;
  const car = p.car;
  if (!car) return [];
  const ahead = { x: car.x + Math.cos(car.angle) * 120, y: car.y + Math.sin(car.angle) * 120 };
  const target = nearestRoadPoint(car.x, car.y + 500);
  // Sidestep around a traffic car directly ahead, so the run never stalls in traffic.
  let side = 0;
  for (const other of world.traffic.cars) {
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const along = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
    const lat = -dx * Math.sin(car.angle) + dy * Math.cos(car.angle);
    if (along > 0 && along < 200 && Math.abs(lat) < 44) {
      side = lat >= 0 ? -56 : 56;
      break;
    }
  }
  const tx = target.x + -Math.sin(car.angle) * side;
  const ty = target.y + Math.cos(car.angle) * side;
  let diff = Math.atan2(ty - ahead.y, tx - ahead.x) - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const keys = ['KeyW'];
  if (diff > 0.12) keys.push('KeyD');
  else if (diff < -0.12) keys.push('KeyA');
  return keys;
}

function putPlayerInCar(world, x, y, angle, color) {
  const car = world.traffic.spawnCar(true) || {
    x, y, angle, speed: 0, color: color || '#c0392b', parked: false, isPolice: false, isPlayer: false,
  };
  car.x = x;
  car.y = y;
  car.angle = angle;
  car.speed = 0;
  car.color = color || '#c0392b';
  car.parked = false;
  car.isPlayer = true;
  world.traffic.takeCar(car);
  world.player.car = car;
  world.player.x = x;
  world.player.y = y;
  world.player.angle = angle;
  world.player.speed = 0;
  return car;
}

function bringPoliceClose(world, count, behind) {
  const p = world.player;
  const cars = world.police.units.filter((u) => u.kind === 'car');
  for (let i = 0; i < Math.min(count, cars.length); i += 1) {
    const u = cars[i];
    const off = behind + i * 90;
    u.x = p.x - Math.cos(p.angle) * off + (i % 2 === 0 ? 46 : -46);
    u.y = p.y - Math.sin(p.angle) * off;
    u.angle = p.angle;
    u.speed = 300;
  }
}

function stepWorld(world, input, seconds, driver) {
  const steps = Math.round(seconds / SAMPLE);
  for (let i = 0; i < steps; i += 1) {
    if (driver) input.inject(driver(world));
    world.step(SAMPLE, input);
  }
  input.clearInject();
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * Names: cover (driving, wanted 3, mission running), mission (on foot at the bank),
 * chase (wanted 4, police on the tail), start (title over a living city).
 */
export function stageShot(name, world, input) {
  world.reset();
  world.screen = 'play';
  if (name === 'start') {
    stepWorld(world, input, 5, null);
    return { screen: 'title' };
  }
  if (name === 'mission') {
    const bank = world.city.landmarks.bank;
    world.player.x = bank.x;
    world.player.y = bank.y + 60;
    world.player.angle = -Math.PI / 2;
    world.missions.startMission(2, world.player);
    // Skip to the vault-cracking objective: the marker and the hold bar show.
    world.missions.step(0.01, world.player, world.police);
    stepWorld(world, input, 3, null);
    return { screen: 'play' };
  }
  if (name === 'chase') {
    const avenue = AVENUES[3];
    putPlayerInCar(world, avenue, 600, Math.PI / 2, '#c0392b');
    world.police.setWanted(4);
    stepWorld(world, input, 1, driveKeys);
    bringPoliceClose(world, 3, 250);
    stepWorld(world, input, 2, driveKeys);
    return { screen: 'play' };
  }
  // cover: driving down the fifth avenue with wanted 3, a mission running.
  const avenue = AVENUES[4];
  putPlayerInCar(world, avenue, 700, Math.PI / 2, '#2980b9');
  world.missions.startMission(1, world.player);
  world.police.setWanted(3);
  stepWorld(world, input, 1, driveKeys);
  bringPoliceClose(world, 2, 250);
  stepWorld(world, input, 2, driveKeys);
  return { screen: 'play' };
}
