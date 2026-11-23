// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps, and the renderer paints what is there. The game moves between five screens:
// title, play, paused, busted and wasted. The next job starts a few seconds after the
// last one ends, so the story keeps moving while the city stays free to roam.
//
// ?seed=N fixes the city and traffic. ?shot=cover|mission|chase|start (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer } from './render.js';
import { createHud } from './hud.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const NEXT_MISSION_DELAY = 5;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const hud = createHud();
const input = createInput(canvas);

// A handle for play-testing and debugging; the game itself never reads it.
window.__solmar = { world, input };

world.load();

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  world.setViewport(canvas.width, canvas.height);
}
window.addEventListener('resize', resize);
resize();

function runShot(name) {
  const scene = stageShot(name, world, input);
  let painted = 0;
  function paint() {
    renderer.draw(world, scene.screen);
    if (scene.screen === 'play') hud.draw(renderer.ctx, world, world.camera);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  let screen = 'title';
  let nextMissionTimer = -1;
  let accumulator = 0;
  let last = performance.now();
  let saveTimer = 0;

  world.screen = 'title';

  function announce(message) {
    status.textContent = message;
  }

  function startMissionIfAny() {
    const next = world.missions.nextMission();
    if (next >= 0) {
      world.missions.startMission(next, world.player);
      announce(`New job: ${world.missions.currentDef().title}.`);
    } else {
      world.missions.showMessage('Rico', 'That is all three jobs, Mara. The city is yours now — keep the cash coming.', 8);
    }
  }

  function startGame(newGame) {
    if (newGame) {
      world.reset();
      world.missions.setCompletedCount(0);
    }
    world.audio.ensure();
    screen = 'play';
    world.screen = 'play';
    startMissionIfAny();
    announce('Playing. Steal a car, follow the gold marker.');
  }

  function respawn() {
    const hospital = world.city.landmarks.hospital;
    world.player.x = hospital.x + 40;
    world.player.y = hospital.y + 40;
    world.player.angle = -Math.PI / 2;
    world.player.health = 100;
    world.player.car = null;
    world.player.speed = 0;
    world.police.clear();
    world.save();
    screen = 'play';
    world.screen = 'play';
    announce('Back on the streets.');
  }

  function handleEvents(events) {
    for (const e of events) {
      if (e.type === 'busted') {
        screen = 'busted';
        world.screen = 'busted';
        announce('Busted. The police took you in.');
      } else if (e.type === 'wasted') {
        screen = 'wasted';
        world.screen = 'wasted';
        announce('Wasted. You woke up at Solmar General.');
      } else if (e.type === 'mission-complete') {
        nextMissionTimer = NEXT_MISSION_DELAY;
      }
    }
  }

  // One-shot actions are read once a frame here and handed to the world; reading
  // them in two places would eat the keypress before the world saw it.
  function handleActions(actions) {
    if (actions & ACTION_CONFIRM) {
      if (screen === 'title') startGame(!world.saveExists);
      else if (screen === 'busted' || screen === 'wasted') respawn();
    }
    if (actions & ACTION_PAUSE) {
      if (screen === 'play') {
        screen = 'paused';
        world.screen = 'paused';
        world.save();
        announce('Paused.');
      } else if (screen === 'paused') {
        screen = 'play';
        world.screen = 'play';
        announce('Playing.');
      }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    handleActions(actions);
    if (screen === 'title') {
      // The city lives behind the title: traffic moves, nothing else happens.
      while (accumulator >= STEP) {
        world.traffic.step(STEP, world.player, null);
        world.time += STEP;
        accumulator -= STEP;
      }
      renderer.draw(world, 'title');
      return;
    }
    if (screen === 'paused' || screen === 'busted' || screen === 'wasted') {
      accumulator = 0;
      renderer.draw(world, screen);
      return;
    }
    // One-shot actions apply to the first step of the frame only; handing the same
    // E press to every catch-up step would enter and then leave the car again.
    let firstStep = true;
    while (accumulator >= STEP) {
      const events = world.step(STEP, input, firstStep ? actions : 0);
      firstStep = false;
      handleEvents(events);
      accumulator -= STEP;
      if (screen !== 'play') break;
    }
    if (nextMissionTimer > 0) {
      nextMissionTimer -= STEP;
      if (nextMissionTimer <= 0) {
        nextMissionTimer = -1;
        startMissionIfAny();
      }
    }
    saveTimer += STEP;
    if (saveTimer > 15) {
      saveTimer = 0;
      world.save();
    }
    renderer.draw(world, 'play');
    hud.draw(renderer.ctx, world, world.camera);
  }

  // Leaving the tab pauses a running game rather than letting the police close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === 'play') {
      screen = 'paused';
      world.screen = 'paused';
      world.save();
      announce('Paused.');
    }
  });

  // N on the title screen starts a new game even when a save exists.
  window.addEventListener('keydown', (event) => {
    if (screen === 'title' && event.code === 'KeyN' && world.saveExists) startGame(true);
  });

  announce('Solmar Bay. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
