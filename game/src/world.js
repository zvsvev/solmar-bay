// The world: everything the game simulates, stepped in fixed 1/60 s slices. The
// player walks or drives, traffic and police move around them, combat and missions
// report events, and the camera follows. main.js owns the screens; this owns the rules.
import {
  BEST_KEY, CAR_ACCEL, CAR_BRAKE, CAR_MAX_REVERSE, CAR_MAX_SPEED, CAR_TURN,
  PLAYER_RADIUS, RUN_SPEED, SAVE_KEY, STEP, WALK_SPEED, WORLD_H, WORLD_W,
} from './config.js';
import { createRandom } from './random.js';
import { createCity, resolveBuildingCollision } from './city.js';
import { createTraffic } from './traffic.js';
import { createPolice } from './police.js';
import { createCombat } from './combat.js';
import { createMissions } from './missions.js';
import { createAudio } from './audio.js';

export function createWorld(seed) {
  const rng = createRandom(seed);
  const city = createCity(rng);
  const traffic = createTraffic(city, rng);
  const police = createPolice(city, rng);
  const combat = createCombat();
  const missions = createMissions(city);
  const audio = createAudio();
  traffic.populate();

  const spawn = city.landmarks.garage;
  const player = {
    x: spawn.x + 60,
    y: spawn.y + 40,
    angle: -Math.PI / 2,
    speed: 0,
    car: null,
    health: 100,
    cash: 0,
    pistol: false,
    ammo: 0,
  };

  const world = {
    city, rng, traffic, police, combat, missions, audio,
    player,
    time: 0,
    screen: 'title',
    banner: null,
    bannerTimer: 0,
    saveExists: false,
    best: 0,
    missionsDone: 0,
    camera: { x: 0, y: 0, w: 1280, h: 720 },
  };

  // A few pickups around the hospital and the garage so the player can recover.
  combat.dropPickup('health', city.landmarks.hospital.x + 40, city.landmarks.hospital.y - 60, 0);
  combat.dropPickup('health', city.landmarks.hospital.x - 50, city.landmarks.hospital.y + 30, 0);
  combat.dropPickup('ammo', city.landmarks.garage.x - 60, city.landmarks.garage.y + 60, 0);
  combat.dropPickup('ammo', city.landmarks.garage.x + 70, city.landmarks.garage.y - 40, 0);

  function missionTarget() {
    const obj = missions.currentObjective();
    if (!obj) return null;
    if (obj.kind === 'steal') {
      // Point at a parked car: chasing a moving one on foot is a fool's errand.
      let best = null;
      let bestD = 4000;
      for (const car of traffic.cars) {
        if (!car.parked || car.isPlayer) continue;
        const d = Math.hypot(car.x - player.x, car.y - player.y);
        if (d < bestD) { bestD = d; best = car; }
      }
      const car = best || traffic.nearestCar(player.x, player.y, 4000);
      return car ? { x: car.x, y: car.y } : null;
    }
    return obj.target ? city.landmarks[obj.target] : null;
  }
  world.missionTarget = missionTarget;

  function enterCar() {
    const car = traffic.nearestCar(player.x, player.y, 72);
    if (!car) return false;
    const wasParked = car.parked;
    traffic.takeCar(car);
    car.isPlayer = true;
    car.parked = false;
    player.car = car;
    player.x = car.x;
    player.y = car.y;
    player.angle = car.angle;
    player.speed = 0;
    if (!wasParked) police.addWanted(1, 'stolen car');
    return true;
  }

  function exitCar() {
    const car = player.car;
    if (!car) return;
    car.isPlayer = false;
    car.parked = true;
    car.speed = 0;
    car.wasParked = true;
    traffic.cars.push(car);
    player.car = null;
    player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 40;
    player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 40;
    player.angle = car.angle;
    player.speed = 0;
    resolveBuildingCollision(city, player, PLAYER_RADIUS);
  }

  function stepOnFoot(dt, input, events) {
    const move = input.walk();
    const len = Math.hypot(move.x, move.y) || 1;
    const speed = move.run ? RUN_SPEED : WALK_SPEED;
    const moving = move.x !== 0 || move.y !== 0;
    if (moving) {
      player.angle = Math.atan2(move.y / len, move.x / len);
      player.x += (move.x / len) * speed * dt;
      player.y += (move.y / len) * speed * dt;
      resolveBuildingCollision(city, player, PLAYER_RADIUS);
    }
    player.x = Math.max(20, Math.min(WORLD_W - 20, player.x));
    player.y = Math.max(20, Math.min(WORLD_H - 20, player.y));
    // Aim at the mouse while the pistol is out.
    if (player.pistol) {
      const m = input.mouse();
      const wx = world.camera.x + m.x;
      const wy = world.camera.y + m.y;
      if (Math.hypot(wx - player.x, wy - player.y) > 30) player.angle = Math.atan2(wy - player.y, wx - player.x);
    }
  }

  function stepDriving(dt, input, events) {
    const car = player.car;
    const drive = input.drive();
    if (drive.throttle > 0) car.speed += CAR_ACCEL * dt;
    else if (drive.throttle < 0) car.speed -= (car.speed > 0 ? CAR_BRAKE : CAR_ACCEL * 0.6) * dt;
    else car.speed -= car.speed * 0.9 * dt;
    if (drive.handbrake) car.speed -= car.speed * 3.2 * dt;
    car.speed = Math.max(-CAR_MAX_REVERSE, Math.min(CAR_MAX_SPEED, car.speed));
    const steerAmount = drive.steer * CAR_TURN * dt * Math.min(1, Math.abs(car.speed) / 160) * Math.sign(car.speed || 1);
    car.angle += steerAmount;
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    car.x = nx;
    car.y = ny;
    const hitBuilding = resolveBuildingCollision(city, car, 24);
    if (hitBuilding && Math.abs(car.speed) > 200) {
      audio.crash();
      car.speed *= 0.45;
    }
    // Bump traffic cars and run over pedestrians.
    for (const other of traffic.cars) {
      if (other === car) continue;
      const d = Math.hypot(other.x - car.x, other.y - car.y);
      if (d < 44 && d > 0.01) {
        const push = (44 - d) / 2;
        const ux = (other.x - car.x) / d;
        const uy = (other.y - car.y) / d;
        other.x += ux * push;
        other.y += uy * push;
        car.x -= ux * push * 0.5;
        car.y -= uy * push * 0.5;
        if (Math.abs(car.speed) > 240) audio.crash();
        // A ram shoves the other car along instead of stopping the player dead.
        other.x += ux * push;
        other.y += uy * push;
        car.speed *= 0.93;
        other.speed = Math.max(0, other.speed - 20);
      }
    }
    for (const ped of traffic.peds) {
      const d = Math.hypot(ped.x - car.x, ped.y - car.y);
      if (d < 30) {
        if (Math.abs(car.speed) > 90) {
          traffic.peds.splice(traffic.peds.indexOf(ped), 1);
          combat.dropPickup('cash', ped.x, ped.y, 25);
          police.addWanted(1, 'hit pedestrian');
          audio.crash();
          events.push({ type: 'crime' });
        } else {
          ped.state = 'flee';
          ped.timer = 1.5;
        }
      }
    }
    player.x = car.x;
    player.y = car.y;
    player.angle = car.angle;
    player.speed = car.speed;
    car.x = Math.max(30, Math.min(WORLD_W - 30, car.x));
    car.y = Math.max(30, Math.min(WORLD_H - 30, car.y));
    audio.engine(Math.abs(car.speed) / CAR_MAX_SPEED);
  }

  world.setViewport = function setViewport(w, h) {
    world.camera.w = w;
    world.camera.h = h;
  };

  world.reset = function reset() {
    player.x = spawn.x + 60;
    player.y = spawn.y + 40;
    player.angle = -Math.PI / 2;
    player.speed = 0;
    player.car = null;
    player.health = 100;
    player.cash = 0;
    player.pistol = false;
    player.ammo = 0;
    police.clear();
    world.time = 0;
    world.banner = null;
    world.bannerTimer = 0;
    missions.setCompletedCount(0);
  };

  world.save = function save() {
    try {
      const best = Math.max(world.best, player.cash);
      world.best = best;
      window.localStorage.setItem(SAVE_KEY, JSON.stringify({
        cash: player.cash, pistol: player.pistol, ammo: player.ammo,
        missionsDone: missions.completedCount, best,
      }));
      window.localStorage.setItem(BEST_KEY, String(best));
      world.saveExists = true;
    } catch { /* storage can be off */ }
  };

  world.load = function load() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      world.best = Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
      world.saveExists = !!raw;
      if (!raw) return false;
      const data = JSON.parse(raw);
      player.cash = data.cash || 0;
      player.pistol = !!data.pistol;
      player.ammo = data.ammo || 0;
      missions.setCompletedCount(data.missionsDone || 0);
      world.missionsDone = data.missionsDone || 0;
      return true;
    } catch {
      return false;
    }
  };

  world.step = function step(dt, input, actions) {
    world.time += dt;
    const events = [];
    actions = actions || 0;

    if (actions & 4) { // ACTION_ENTER
      if (player.car) exitCar();
      else if (enterCar()) audio.pickup();
    }
    if (actions & 8) { // ACTION_PUNCH
      if (!player.car) {
        const res = combat.punch(player, traffic.peds, police.units);
        if (res) {
          audio.punch();
          if (res.crime) police.addWanted(res.crime, 'assault');
          if (res.policeHit) police.resetBust();
          if (res.hit || res.killed) events.push({ type: 'crime' });
        }
      }
    }
    if (actions & 16) { // ACTION_SHOOT
      if (!player.car && player.pistol) {
        const m = input.mouse();
        const res = combat.shoot(player, world.camera.x + m.x, world.camera.y + m.y);
        if (res) {
          audio.gunshot();
          police.addWanted(res.crime, 'gunfire');
          events.push({ type: 'gunfire', x: player.x, y: player.y });
        }
      }
    }
    if (actions & 32) { // ACTION_MUTE
      audio.toggleMute();
    }

    if (player.car) stepDriving(dt, input, events);
    else stepOnFoot(dt, input, events);

    // Police officers on foot punch the player when they close in at high heat.
    for (const unit of police.units) {
      if (unit.kind === 'ped' && !player.car && police.wanted >= 3) {
        const d = Math.hypot(unit.x - player.x, unit.y - player.y);
        unit.punchTimer = (unit.punchTimer || 0) - dt;
        if (d < 34 && unit.punchTimer <= 0) {
          unit.punchTimer = 0.85;
          player.health -= 6;
          audio.punch();
        }
      }
    }

    const gunfire = events.find((e) => e.type === 'gunfire');
    traffic.step(dt, player, gunfire ? { x: gunfire.x, y: gunfire.y } : null);
    const policeResult = police.step(dt, player);
    const combatEvents = combat.step(dt, traffic.peds, police.units, traffic.cars);
    for (const e of combatEvents) {
      if (e.crime) police.addWanted(e.crime, 'shooting');
      if (e.policeDown) police.resetBust();
      if (e.killed) events.push({ type: 'crime' });
    }
    const gained = combat.collect(player);
    if (gained > 0) {
      player.cash += gained;
      audio.pickup();
    }

    const missionEvents = missions.step(dt, player, police);
    for (const e of missionEvents) {
      if (e.type === 'objective') {
        world.banner = { title: 'OBJECTIVE', sub: e.text, color: '#ffd23f' };
        world.bannerTimer = 2.2;
      } else if (e.type === 'complete') {
        player.cash += e.reward;
        world.missionsDone = missions.completedCount;
        world.banner = { title: 'JOB DONE', sub: `${e.title} — +$${e.reward}`, color: '#37c978' };
        world.bannerTimer = 3;
        audio.cash();
        world.save();
        events.push({ type: 'mission-complete', title: e.title, reward: e.reward });
      } else if (e.type === 'alarm') {
        audio.alarm();
        world.banner = { title: 'ALARM TRIPPED', sub: 'The vault is open — lose the heat!', color: '#e5484d' };
        world.bannerTimer = 2.5;
      }
    }

    if (policeResult.busted) {
      events.push({ type: 'busted' });
      player.cash = Math.floor(player.cash * 0.9);
      police.clear();
      return events;
    }
    if (player.health <= 0) {
      events.push({ type: 'wasted' });
      player.cash = Math.floor(player.cash * 0.9);
      police.clear();
      return events;
    }

    if (world.bannerTimer > 0) {
      world.bannerTimer -= dt;
      if (world.bannerTimer <= 0) world.banner = null;
    }

    // Camera follows, clamped to the city.
    const tx = Math.max(0, Math.min(WORLD_W - world.camera.w, player.x - world.camera.w / 2));
    const ty = Math.max(0, Math.min(WORLD_H - world.camera.h, player.y - world.camera.h / 2));
    world.camera.x += (tx - world.camera.x) * Math.min(1, dt * 5);
    world.camera.y += (ty - world.camera.y) * Math.min(1, dt * 5);

    audio.siren(police.wanted >= 1);
    if (!player.car) audio.engine(0);
    return events;
  };

  return world;
}
