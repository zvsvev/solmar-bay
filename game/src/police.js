// The wanted system and the police who answer it. Stars rise with crimes and fall
// when the player stays out of sight; police cars spawn to match the level, chase the
// player and ram, and at higher levels officers on foot join the pursuit. Getting
// caught on foot while wanted ends in a bust.
import { CAR_MAX_SPEED, MAX_WANTED, WANTED_DECAY_SECONDS } from './config.js';
import { randomRoadPoint } from './city.js';

const POLICE_BLUE = '#2f6fd0';
const POLICE_WHITE = '#e8ecf1';

export function createPolice(city, rng) {
  const units = []; // { kind: 'car' | 'ped', x, y, angle, speed, health }
  let wanted = 0;
  let decayTimer = WANTED_DECAY_SECONDS;
  let bustedTimer = 0;
  let bustGrace = 0; // fighting back buys time: no arrest while the player resists

  function addWanted(n, reason) {
    if (n <= 0) return;
    wanted = Math.min(MAX_WANTED, wanted + n);
    decayTimer = WANTED_DECAY_SECONDS;
    return reason;
  }

  function spawnUnit(kind, nearX, nearY) {
    const p = randomRoadPoint(city, rng);
    // Spawn a few hundred pixels away, on a road, so the chase arrives rather than pops in.
    let x = p.x;
    let y = p.y;
    for (let tries = 0; tries < 12; tries += 1) {
      const q = randomRoadPoint(city, rng);
      const d = Math.hypot(q.x - nearX, q.y - nearY);
      if (d > 420 && d < 900) { x = q.x; y = q.y; break; }
    }
    const unit = { kind, x, y, angle: Math.atan2(nearY - y, nearX - x), speed: 0, health: kind === 'car' ? 220 : 60 };
    units.push(unit);
    return unit;
  }

  function desiredUnits() {
    return wanted === 0 ? 0 : wanted <= 1 ? 1 : wanted <= 2 ? 2 : wanted <= 3 ? 3 : 4;
  }

  function stepCar(unit, dt, player) {
    const target = Math.atan2(player.y - unit.y, player.x - unit.x);
    let diff = target - unit.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    unit.angle += Math.max(-3.2 * dt, Math.min(3.2 * dt, diff));
    const wantSpeed = CAR_MAX_SPEED * (0.86 + wanted * 0.03);
    unit.speed += (wantSpeed - unit.speed) * Math.min(1, dt * 1.4);
    // Chase, don't pile on: hold a little distance instead of driving through the player.
    const d = Math.hypot(player.x - unit.x, player.y - unit.y);
    const playerSpeed = player.car ? Math.abs(player.car.speed) : 0;
    if (d < 80) unit.speed = Math.min(unit.speed, playerSpeed + 40);
    unit.x += Math.cos(unit.angle) * unit.speed * dt;
    unit.y += Math.sin(unit.angle) * unit.speed * dt;
  }

  function stepPed(unit, dt, player) {
    const d = Math.hypot(player.x - unit.x, player.y - unit.y);
    const target = Math.atan2(player.y - unit.y, player.x - unit.x);
    unit.angle = target;
    unit.speed = d > 60 ? 235 : 120;
    unit.x += Math.cos(unit.angle) * unit.speed * dt;
    unit.y += Math.sin(unit.angle) * unit.speed * dt;
  }

  return {
    units,
    get wanted() { return wanted; },
    setWanted(n) {
      wanted = Math.max(0, Math.min(MAX_WANTED, n));
      decayTimer = WANTED_DECAY_SECONDS;
    },
    addWanted,
    clear() {
      wanted = 0;
      units.length = 0;
      bustedTimer = 0;
      bustGrace = 0;
    },
    /** The player fought an officer off: the arrest clock resets and pauses. */
    resetBust() {
      bustedTimer = 0;
      bustGrace = 1.5;
    },
    colors: { blue: POLICE_BLUE, white: POLICE_WHITE },
    step(dt, player) {
      if (wanted === 0) {
        // Units already out give up and drive off.
        for (let i = units.length - 1; i >= 0; i -= 1) {
          const u = units[i];
          u.x += Math.cos(u.angle) * 120 * dt;
          u.y += Math.sin(u.angle) * 120 * dt;
          if (Math.hypot(u.x - player.x, u.y - player.y) > 1200) units.splice(i, 1);
        }
        return { busted: false };
      }
      decayTimer -= dt;
      if (decayTimer <= 0) {
        wanted = Math.max(0, wanted - 1);
        decayTimer = WANTED_DECAY_SECONDS;
      }
      // Keep the pursuit at the level's strength.
      const wantCars = desiredUnits();
      const haveCars = units.filter((u) => u.kind === 'car').length;
      if (haveCars < wantCars) spawnUnit('car', player.x, player.y);
      if (wanted >= 3) {
        const havePeds = units.filter((u) => u.kind === 'ped').length;
        if (havePeds < wanted - 2) spawnUnit('ped', player.x, player.y);
      }
      let busted = false;
      let anyContact = false;
      if (bustGrace > 0) bustGrace -= dt;
      for (const unit of units) {
        if (unit.kind === 'car') stepCar(unit, dt, player);
        else stepPed(unit, dt, player);
        // An officer on foot who reaches the player starts the bust — unless the
        // player has just fought back, which resets the arrest clock.
        if (unit.kind === 'ped' && !player.car && bustGrace <= 0 && Math.hypot(unit.x - player.x, unit.y - player.y) < 26) {
          anyContact = true;
          bustedTimer += dt;
          if (bustedTimer > 2.2) busted = true;
        }
      }
      if (!anyContact) bustedTimer = 0;
      if (player.car) bustedTimer = 0;
      return { busted };
    },
  };
}
