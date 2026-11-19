// The street, in game pixels. Shared by the simulation (positions, ranges) and the scene (drawing),
// so what you see is exactly what is simulated. No Phaser or DOM here: `npm run sim` runs it in Node.

export const LANES = 5;
/** Top of the first lane and the lane height (the road in the area art spans y 270 … 890). */
export const LANE_TOP = 274;
export const LANE_H = 122;
/** Each lane has two cat slots left of the wall. */
export const COLS = 2;
export const SLOT_X = [64, 176] as const;
/** The wall of crates: enemies stop here and hit it. */
export const WALL_X = 250;
/** Enemies walk in from just off the right edge. */
export const SPAWN_X = 790;
/** Where an attacking enemy's feet stop (its arms reach the wall). */
export const STOP_X = WALL_X + 52;

export const laneCenter = (lane: number) => LANE_TOP + LANE_H * lane + LANE_H / 2;
/** Feet line of a lane: sprites are anchored bottom-centre. */
export const laneFeet = (lane: number) => laneCenter(lane) + 50;
export const slotIndex = (lane: number, col: number) => lane * COLS + col;
export const slotLane = (slot: number) => Math.floor(slot / COLS);
export const slotCol = (slot: number) => slot % COLS;
