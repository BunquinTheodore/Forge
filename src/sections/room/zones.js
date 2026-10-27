/**
 * The seven zones of the FORGE environment (programme p9).
 * Shared by RoomSection (DOM) and RoomAct (GL). No three.js here.
 *
 * Floor plan lives on a 6 x 4 cell grid. c/r = top-left cell, w/h = span in cells,
 * lift = extruded block height in world units. The CSS fallback in room.css uses the same grid.
 */
export const GRID = { cols: 6, rows: 4 };

export const ZONES = [
  { id: 'gallery', name: 'Project gallery', note: 'Prepared ventures', c: 0, r: 0, w: 2, h: 2, lift: 0.3 },
  { id: 'desk', name: 'FORGE desk', note: 'Routing & facilitation', c: 2, r: 0, w: 1, h: 1, lift: 0.55 },
  { id: 'tables', name: 'Working tables', note: 'Venture conversations', c: 3, r: 0, w: 3, h: 2, lift: 0.35 },
  { id: 'deals', name: 'Deal rooms', note: 'Private next steps', c: 4, r: 2, w: 2, h: 2, lift: 0.8 },
  { id: 'network', name: 'Capability & capital network', note: 'People who can add value', c: 0, r: 2, w: 2, h: 2, lift: 0.4 },
  { id: 'risk', name: 'Risk & readiness', note: 'Finance / risk dialogue', c: 2, r: 1, w: 1, h: 2, lift: 0.6 },
  { id: 'outcome', name: 'Outcome desk', note: 'Action & follow-up', c: 2, r: 3, w: 2, h: 1, lift: 0.5 },
];

/** The main flow a venture takes through the room. */
export const FLOW = ['gallery', 'desk', 'tables', 'deals', 'outcome'];

export const zoneIndex = (id) => ZONES.findIndex((z) => z.id === id);

/** World-space centre of a zone on the floor plane (x, z), grid centred on the origin. */
export function zoneCentre(zone) {
  return {
    x: zone.c + zone.w / 2 - GRID.cols / 2,
    z: zone.r + zone.h / 2 - GRID.rows / 2,
  };
}
