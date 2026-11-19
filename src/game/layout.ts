// The street, in game pixels (landscape 1440×720). Shared by the simulation (positions, ranges) and the scene
// (drawing), so what you see is exactly what is simulated. No Phaser or DOM here: `npm run sim` runs it in Node.
//
// The kit's Area art already has a 2×5 cat grid, a crate wall and a wall health bar on its left side. These
// numbers are measured on Area1.png (2143×1062, same layout in all 5 areas) and scaled by BG_SCALE.

/** Source px → game px: the 1062 px tall Area art fills the 720 px tall screen. */
export const BG_SCALE = 720 / 1062;
const k = (srcPx: number) => srcPx * BG_SCALE;

export const LANES = 5;
/** Lane centres follow the grid rows (source y 300, 415, 530, 645, 760). */
export const LANE_H = k(115);
export const LANE_TOP = k(300) - LANE_H / 2;
/** Each lane has two cat spots: the kit grid's two columns (source x 272 and 410). */
export const COLS = 2;
export const SLOT_X = [k(272), k(410)] as const;
export const SLOT_SIZE = k(95);
/** The crate wall (source x 520–645) and its health bar channel (source x 670–692, y 268–678). */
export const WALL_X0 = k(520), WALL_X1 = k(645);
export const WALL_BAR = { x: k(670), y: k(268), w: k(22), h: k(410) };
/** Enemies walk in from just off the right edge. */
export const SPAWN_X = 1480;
/** Where an attacking enemy's feet stop: its arms reach over the wall bar. */
export const STOP_X = k(735);

/**
 * Distances, speeds and ranges are tuned in "street units": 1 unit = this many game px. The street (spawn → wall)
 * is ~955 px, about 1.95× the first (portrait) build, so walking times and ranges keep their tested balance.
 */
export const U = 1.95;

export const laneCenter = (lane: number) => LANE_TOP + LANE_H * lane + LANE_H / 2;
/** Feet line of a lane: sprites are anchored bottom-centre. */
export const laneFeet = (lane: number) => laneCenter(lane) + LANE_H * 0.36;
export const slotIndex = (lane: number, col: number) => lane * COLS + col;
export const slotLane = (slot: number) => Math.floor(slot / COLS);
export const slotCol = (slot: number) => slot % COLS;
