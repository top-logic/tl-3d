/**
 * Constants used in the application
 */

export const WHITE = 0xffffff;
export const LIGHT_GREY = "#cccccc";
export const DARK_GREY = "#333333";
export const RED = 0xff0000;
export const YELLOW = 0xffff00;
export const GREEN = 0x00ff00;
export const SELECTION_COLOR = GREEN;
export const LIGHT_BLUE = 0x77aacc;
export const MIDDLE_BLUE = 0x447799;
export const DARK_BLUE = 0x001122;
export const CUBE_CAMERA_FAR = 10;
export const CAMERA_MOVE_DURATION = 1.5;
export const C_P_RADIUS = 100;
export const WIDTH_SEGMENTS = 8;
export const HEIGHT_SEGMENTS = 8;
export const _90_DEGREE = Math.PI / 2;
export const OPTIMIZED_PIXEL_RATIO = Math.min(window.devicePixelRatio, 1.7);
export const INTERACTIVE_PIXEL_RATIO = Math.min(window.devicePixelRatio, 1.0);
export const GRID_SMALL_CELL = 500;
export const SNAP_THRESHOLD = 50;
export const GRID_SNAP_THRESHOLD = 200;
export const FLOOR_PADDING = 20000;
// Make non-selected objects 30% transparent
export const TRANSPARENCY_LEVEL = 0.3;
// Total instanced triangle budget (sum of triangleCount * instanceCount across
// all managed meshes) above which BVH-accelerated visibility culling kicks in.
// Below this, all instances are rendered every frame unconditionally.
export const INSTANCING_BVH_TRIANGLE_THRESHOLD = 8_000_000;
// Maximum triangles the BVH is allowed to accumulate in its visible set
// before it starts rejecting new hits. Should be higher than the threshold above.
export const INSTANCING_BVH_MAX_TRIANGLES = 10_000_000;
// Number of frames an instance can go undetected by BVH raycasting before
// it gets pruned from the visible set.
export const INSTANCING_BVH_STALE_FRAME_THRESHOLD = 30;
// When an incremental update adds more children than this, trigger a full
// reload so analyzeForInstancing can fold them into instanced groups.
export const INCREMENTAL_ADD_RELOAD_THRESHOLD = 25;
