/**
 * roomplan3d.ts
 *
 * Extends the 2D floor-plan/elevation geometry in lib/roomplan.ts one step
 * further: builds a simple 3D "massing" model (walls, doors, windows,
 * openings, objects as oriented boxes) directly from the same RoomPlan
 * transforms, for an in-browser interactive preview. This is a geometric
 * reconstruction, not a render of the actual scanned mesh/texture (see
 * Room3DViewer.tsx for why — no practical USDZ parser exists client-side).
 */

import { hasTransform, pos, yawDeg, M_TO_FT, type RoomData } from "./roomplan";

export type Box3DKind = "wall" | "door" | "window" | "opening" | "object";

export interface Box3D {
  kind: Box3DKind;
  category?: string; // for objects
  // Center position, feet. cy is height above floor (RoomPlan's Y axis).
  cx: number;
  cy: number;
  cz: number;
  width: number; // along the box's local X axis, feet
  height: number; // along Y (vertical), feet
  depth: number; // along the box's local Z axis, feet
  rotationDeg: number; // rotation around Y axis
}

export interface Room3DScene {
  boxes: Box3D[];
  bounds: { min_x: number; max_x: number; min_z: number; max_z: number; max_y: number };
}

const WALL_THICKNESS_FT = 0.3;
const OPENING_THICKNESS_FT = 0.2; // door/window/opening insert, slightly proud of the wall face

function surfaceBox(
  kind: Box3DKind,
  s: { width_ft: number; height_ft: number; transform: number[] },
  depth: number
): Box3D {
  const [cx, cy, cz] = pos(s.transform);
  return {
    kind,
    cx: cx * M_TO_FT,
    cy: cy * M_TO_FT,
    cz: cz * M_TO_FT,
    width: s.width_ft,
    height: s.height_ft,
    depth,
    rotationDeg: yawDeg(s.transform),
  };
}

export function buildRoom3D(room: RoomData): Room3DScene {
  const boxes: Box3D[] = [
    ...room.walls.filter(hasTransform).map((w) => surfaceBox("wall", w, WALL_THICKNESS_FT)),
    ...room.doors.filter(hasTransform).map((d) => surfaceBox("door", d, OPENING_THICKNESS_FT)),
    ...room.windows.filter(hasTransform).map((w) => surfaceBox("window", w, OPENING_THICKNESS_FT)),
    ...room.openings.filter(hasTransform).map((o) => surfaceBox("opening", o, OPENING_THICKNESS_FT)),
    ...room.objects.filter(hasTransform).map((o) => {
      const [cx, cy, cz] = pos(o.transform);
      return {
        kind: "object" as const,
        category: o.category,
        cx: cx * M_TO_FT,
        cy: cy * M_TO_FT,
        cz: cz * M_TO_FT,
        width: o.width_ft,
        height: o.height_ft,
        depth: o.depth_ft,
        rotationDeg: yawDeg(o.transform),
      };
    }),
  ];

  const xs: number[] = [];
  const zs: number[] = [];
  let maxY = 0;
  for (const b of boxes) {
    xs.push(b.cx - b.width / 2, b.cx + b.width / 2);
    zs.push(b.cz - b.depth / 2, b.cz + b.depth / 2);
    maxY = Math.max(maxY, b.cy + b.height / 2);
  }

  return {
    boxes,
    bounds: {
      min_x: xs.length ? Math.min(...xs) : 0,
      max_x: xs.length ? Math.max(...xs) : 0,
      min_z: zs.length ? Math.min(...zs) : 0,
      max_z: zs.length ? Math.max(...zs) : 0,
      max_y: maxY,
    },
  };
}
