// Combat: fists, the pistol, bullets and pickups. A punch is a short arc in front of
// the player; a shot is a bullet toward the mouse. Hitting a pedestrian or an officer
// is a crime, so combat feeds the wanted system through the events it returns.
import { BULLET_SPEED, PISTOL_DAMAGE, PLAYER_RADIUS, PUNCH_DAMAGE, PUNCH_RANGE } from './config.js';

export function createCombat() {
  const bullets = [];
  const pickups = []; // { kind: 'health' | 'ammo' | 'cash', x, y, value }
  let punchCooldown = 0;
  let shootCooldown = 0;
  let muzzle = 0;

  function dropPickup(kind, x, y, value) {
    pickups.push({ kind, x, y, value: value || 0 });
  }

  function punch(player, peds, policeUnits) {
    if (punchCooldown > 0) return null;
    punchCooldown = 0.38;
    muzzle = 0.08;
    const ax = player.x + Math.cos(player.angle) * PUNCH_RANGE;
    const ay = player.y + Math.sin(player.angle) * PUNCH_RANGE;
    for (const ped of peds) {
      if (Math.hypot(ped.x - ax, ped.y - ay) < 30) {
        ped.health -= PUNCH_DAMAGE;
        ped.state = 'flee';
        ped.timer = 1.5;
        if (ped.health <= 0) {
          peds.splice(peds.indexOf(ped), 1);
          dropPickup('cash', ped.x, ped.y, 20);
          return { crime: 1, killed: true };
        }
        return { crime: 0, hit: true };
      }
    }
    // A punch at an officer is a swing in every direction: the player is brawling,
    // not duelling, and every officer close by is knocked back.
    let policeHit = false;
    for (const unit of policeUnits) {
      if (unit.kind === 'ped' && Math.hypot(unit.x - player.x, unit.y - player.y) < 48) {
        unit.health -= PUNCH_DAMAGE;
        unit.x += Math.cos(player.angle) * 42;
        unit.y += Math.sin(player.angle) * 42;
        policeHit = true;
        if (unit.health <= 0) {
          policeUnits.splice(policeUnits.indexOf(unit), 1);
          return { crime: 2, killed: true, policeHit: true };
        }
      }
    }
    if (policeHit) return { crime: 1, hit: true, policeHit: true };
    return { crime: 0, hit: false };
  }

  function shoot(player, targetX, targetY) {
    if (shootCooldown > 0 || player.ammo <= 0 || !player.pistol) return null;
    shootCooldown = 0.22;
    player.ammo -= 1;
    muzzle = 0.07;
    const angle = Math.atan2(targetY - player.y, targetX - player.x);
    bullets.push({
      x: player.x + Math.cos(angle) * (PLAYER_RADIUS + 8),
      y: player.y + Math.sin(angle) * (PLAYER_RADIUS + 8),
      vx: Math.cos(angle) * BULLET_SPEED,
      vy: Math.sin(angle) * BULLET_SPEED,
      life: 0.9,
    });
    return { crime: 1 };
  }

  function step(dt, peds, policeUnits, cars) {
    punchCooldown = Math.max(0, punchCooldown - dt);
    shootCooldown = Math.max(0, shootCooldown - dt);
    muzzle = Math.max(0, muzzle - dt);
    const events = [];
    for (let i = bullets.length - 1; i >= 0; i -= 1) {
      const b = bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      let dead = b.life <= 0;
      if (!dead) {
        for (const ped of peds) {
          if (Math.hypot(ped.x - b.x, ped.y - b.y) < 16) {
            ped.health -= PISTOL_DAMAGE;
            ped.state = 'flee';
            ped.timer = 1.5;
            dead = true;
            if (ped.health <= 0) {
              peds.splice(peds.indexOf(ped), 1);
              dropPickup('cash', ped.x, ped.y, 20);
              events.push({ crime: 1, killed: true });
            } else {
              events.push({ crime: 1, hit: true });
            }
            break;
          }
        }
      }
      if (!dead) {
        for (const unit of policeUnits) {
          if (Math.hypot(unit.x - b.x, unit.y - b.y) < (unit.kind === 'car' ? 26 : 16)) {
            unit.health -= PISTOL_DAMAGE;
            dead = true;
            if (unit.health <= 0) {
              policeUnits.splice(policeUnits.indexOf(unit), 1);
              events.push({ crime: 2, killed: true, policeDown: true });
            } else {
              events.push({ crime: 1, hit: true });
            }
            break;
          }
        }
      }
      if (!dead) {
        for (const car of cars) {
          if (car.isPlayer) continue;
          if (Math.hypot(car.x - b.x, car.y - b.y) < 26) { dead = true; break; }
        }
      }
      if (dead) bullets.splice(i, 1);
    }
    return events;
  }

  return {
    bullets,
    pickups,
    dropPickup,
    punch,
    shoot,
    step,
    get muzzle() { return muzzle; },
    collect(player) {
      let gained = 0;
      for (let i = pickups.length - 1; i >= 0; i -= 1) {
        const p = pickups[i];
        if (Math.hypot(p.x - player.x, p.y - player.y) < 30) {
          if (p.kind === 'health') player.health = Math.min(100, player.health + 40);
          if (p.kind === 'ammo') player.ammo += 12;
          if (p.kind === 'cash') gained += p.value;
          pickups.splice(i, 1);
        }
      }
      return gained;
    },
  };
}
