// Keyboard and mouse input. Keys are tracked by code so the layout does not matter;
// the mouse gives an aim point in screen space. Shots and tests can inject a synthetic
// state through `inject`, which the real handlers override on the next real event.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_PUNCH = 8;
export const ACTION_SHOOT = 16;
export const ACTION_MUTE = 32;

export function createInput(canvas) {
  const keys = new Set();
  const mouse = { x: 0, y: 0, down: false, clicked: false };
  let actions = 0;
  let injected = null;

  function keyDown(event) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'Space' || event.code === 'Enter') actions |= ACTION_CONFIRM;
    if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACTION_PAUSE;
    if (event.code === 'KeyE') actions |= ACTION_ENTER;
    if (event.code === 'KeyF') actions |= ACTION_PUNCH;
    if (event.code === 'KeyM') actions |= ACTION_MUTE;
  }
  function keyUp(event) {
    keys.delete(event.code);
  }
  function mouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
  }
  function mouseDown(event) {
    mouseMove(event);
    mouse.down = true;
    mouse.clicked = true;
    actions |= ACTION_SHOOT | ACTION_CONFIRM;
  }
  function mouseUp() {
    mouse.down = false;
  }

  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
  canvas.addEventListener('mousemove', mouseMove);
  canvas.addEventListener('mousedown', mouseDown);
  window.addEventListener('mouseup', mouseUp);

  return {
    /** -1/0/1 steering and throttle from WASD or the arrow keys. */
    drive() {
      const k = injected ?? keys;
      const has = (c) => k.has(c);
      const steer = (has('KeyA') || has('ArrowLeft') ? -1 : 0) + (has('KeyD') || has('ArrowRight') ? 1 : 0);
      const throttle = (has('KeyW') || has('ArrowUp') ? 1 : 0) + (has('KeyS') || has('ArrowDown') ? -1 : 0);
      return { steer, throttle, handbrake: has('Space') };
    },
    /** -1/0/1 movement on foot. */
    walk() {
      const k = injected ?? keys;
      const has = (c) => k.has(c);
      return {
        x: (has('KeyD') || has('ArrowRight') ? 1 : 0) - (has('KeyA') || has('ArrowLeft') ? 1 : 0),
        y: (has('KeyS') || has('ArrowDown') ? 1 : 0) - (has('KeyW') || has('ArrowUp') ? 1 : 0),
        run: has('ShiftLeft') || has('ShiftRight'),
      };
    },
    mouse() {
      return mouse;
    },
    /** One-shot actions since the last call; also clears the mouse click. */
    takeActions() {
      const out = actions;
      actions = 0;
      mouse.clicked = false;
      return out;
    },
    /** Drive the game from code (screenshot scenes, tests). */
    inject(codes) {
      injected = new Set(codes);
    },
    clearInject() {
      injected = null;
    },
  };
}
