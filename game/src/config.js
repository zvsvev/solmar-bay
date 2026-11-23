// Solmar Bay — shared constants: world size, road grid, palette, tuning.
// The city is a fixed 3200 x 2400 world. Avenues run north-south, streets east-west;
// every road is ROAD_W wide and the blocks between them hold the buildings.
export const STEP = 1 / 60;
export const WORLD_W = 3200;
export const WORLD_H = 2400;
export const ROAD_W = 96;
export const AVENUES = [220, 620, 1020, 1420, 1820, 2220, 2620, 2980];
export const STREETS = [200, 500, 800, 1100, 1400, 1700, 2000, 2240];
export const BEACH_Y = 2240; // everything south of this line is sand and sea

export const SAVE_KEY = 'solmar-bay-save-v1';
export const BEST_KEY = 'solmar-bay-best-v1';

export const WALK_SPEED = 175;
export const RUN_SPEED = 265;
export const CAR_ACCEL = 420;
export const CAR_BRAKE = 620;
export const CAR_MAX_SPEED = 560;
export const CAR_MAX_REVERSE = 180;
export const CAR_TURN = 2.6;

export const PLAYER_RADIUS = 14;
export const CAR_W = 46;
export const CAR_H = 22;
export const PUNCH_RANGE = 34;
export const PUNCH_DAMAGE = 25;
export const PISTOL_DAMAGE = 34;
export const BULLET_SPEED = 900;
export const WANTED_DECAY_SECONDS = 26;
export const MAX_WANTED = 5;

export const PALETTE = {
  grass: '#5d8a4a',
  grassDark: '#527c41',
  road: '#33373d',
  roadEdge: '#454a52',
  lane: '#e8d44d',
  sidewalk: '#8d9299',
  sand: '#e3cd8f',
  sea: '#2e7fa8',
  seaDeep: '#1f5f84',
  buildingRoof: '#b08968',
  park: '#4a7d3c',
  water: '#2e7fa8',
  hud: '#10151d',
};

// A small set of paint jobs for traffic and the player's stolen rides.
export const CAR_COLORS = ['#c0392b', '#2980b9', '#f39c12', '#7f8c8d', '#16a085', '#8e44ad', '#d35400', '#2c3e50', '#c0c5ce', '#e74c3c'];
export const PED_SHIRTS = ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#9b59b6', '#e67e22', '#ecf0f1', '#1abc9c'];
