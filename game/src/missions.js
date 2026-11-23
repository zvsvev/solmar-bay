// The story: Mara Voss, a driver new to Solmar Bay, works for Rico Hale, who runs a
// garage off the second avenue. Three jobs, each a small chain of go-there-do-that
// objectives with a phone message at the start and a cash reward at the end. Between
// jobs the city is free to roam.
export const MISSION_DEFS = [
  {
    id: 'first-wheels',
    title: 'First Wheels',
    giver: 'Rico',
    reward: 300,
    intro: "Rico: New in town? I need wheels, no questions. Grab any car and bring it to my garage. Don't wreck it.",
    objectives: [
      { kind: 'steal', text: 'Steal a car (walk up to one and press E)' },
      { kind: 'goto', target: 'garage', text: "Drive the car to Rico's Garage" },
    ],
  },
  {
    id: 'the-drop',
    title: 'The Drop',
    giver: 'Rico',
    reward: 600,
    intro: "Rico: A package is waiting at Sunset Pier. Pick it up, drop it at the Palms Motel. Cops are watching the pier, so expect company.",
    objectives: [
      { kind: 'goto', target: 'pier', text: 'Pick up the package at Sunset Pier' },
      { kind: 'goto', target: 'motel', text: 'Deliver the package to the Palms Motel' },
    ],
  },
  {
    id: 'bayfront-job',
    title: 'The Bayfront Job',
    giver: 'Rico',
    reward: 1500,
    intro: "Rico: The big one. Bayfront Bank, vault floor. Stay inside the marker till the safe opens, then lose the heat and get to the safehouse. You get a pistol for this one.",
    objectives: [
      { kind: 'goto', target: 'bank', text: 'Reach Bayfront Bank' },
      { kind: 'hold', target: 'bank', seconds: 8, text: 'Crack the vault — stay in the marker (8s)' },
      { kind: 'goto', target: 'safehouse', text: 'Escape to the Safehouse' },
    ],
  },
];

export function createMissions(city) {
  let index = -1; // no mission active
  let objective = 0;
  let holdTimer = 0;
  let message = null; // { from, text, until }
  let messageTimer = 0;
  let completedCount = 0;

  function targetPos(landmark) {
    return city.landmarks[landmark];
  }

  function currentDef() {
    return index >= 0 && index < MISSION_DEFS.length ? MISSION_DEFS[index] : null;
  }

  function currentObjective() {
    const def = currentDef();
    return def ? def.objectives[objective] : null;
  }

  function showMessage(from, text, seconds) {
    message = { from, text };
    messageTimer = seconds || 6;
  }

  function startMission(i, player) {
    index = i;
    objective = 0;
    holdTimer = 0;
    const def = MISSION_DEFS[i];
    if (i === 2 && !player.pistol) {
      player.pistol = true;
      player.ammo = Math.max(player.ammo, 24);
    }
    showMessage(def.giver, def.intro, 8);
    return def;
  }

  function nextMission() {
    return completedCount < MISSION_DEFS.length ? completedCount : -1;
  }

  return {
    get index() { return index; },
    get completedCount() { return completedCount; },
    get message() { return messageTimer > 0 ? message : null; },
    currentDef,
    currentObjective,
    nextMission,
    targetPos,
    startMission,
    showMessage,
    setCompletedCount(n) { completedCount = n; },
    /** Advance the mission state; returns events for the world to act on. */
    step(dt, player, police) {
      const events = [];
      if (messageTimer > 0) messageTimer -= dt;
      const def = currentDef();
      if (!def) return events;
      const obj = def.objectives[objective];
      const pos = obj.target ? targetPos(obj.target) : null;
      const dist = pos ? Math.hypot(player.x - pos.x, player.y - pos.y) : Infinity;
      if (obj.kind === 'steal') {
        if (player.car) {
          objective += 1;
          events.push({ type: 'objective', text: def.objectives[objective].text });
        }
      } else if (obj.kind === 'goto') {
        if (dist < 70) {
          if (index === 1 && objective === 0) police.setWanted(2);
          objective += 1;
          if (objective >= def.objectives.length) {
            events.push({ type: 'complete', reward: def.reward, title: def.title });
            completedCount = index + 1;
            index = -1;
            objective = 0;
          } else {
            events.push({ type: 'objective', text: def.objectives[objective].text });
          }
        }
      } else if (obj.kind === 'hold') {
        if (dist < 80) {
          if (holdTimer === 0) {
            police.setWanted(4);
            events.push({ type: 'alarm' });
          }
          holdTimer += dt;
          if (holdTimer >= obj.seconds) {
            objective += 1;
            holdTimer = 0;
            events.push({ type: 'objective', text: def.objectives[objective].text });
          }
        } else {
          // Stepping out pauses the crack rather than undoing it.
          holdTimer = Math.max(0, holdTimer - dt * 0.75);
        }
      }
      return events;
    },
    /** Progress 0..1 of the current hold objective, for the HUD bar. */
    holdProgress() {
      const def = currentDef();
      if (!def) return 0;
      const obj = def.objectives[objective];
      if (!obj || obj.kind !== 'hold') return 0;
      return Math.min(1, holdTimer / obj.seconds);
    },
  };
}
