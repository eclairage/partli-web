/**
 * roomplan.ts
 *
 * Converts RoomPlan scan data (with 4×4 transforms) into 2D floor plan
 * and wall elevation geometry ready for rendering.
 *
 * Coordinate conventions from RoomPlan:
 *   Y = up, XZ = floor plane
 *
 * Transform arrays are column-major (16 values):
 *   col0 = local X axis  (along wall width)  → indices 0–3
 *   col1 = local Y axis  (up)                → indices 4–7
 *   col2 = local Z axis  (wall outward normal) → indices 8–11
 *   col3 = position (center of element)      → indices 12–15
 */

// ─── Raw types (as stored in Supabase room_data JSON) ───────────────────────

export interface RawSurface {
  width_ft: number;
  height_ft: number;
  confidence: string;
  transform?: number[]; // 16 values, column-major (absent on pre-Path-A scans)
}

export interface RawObject {
  category: string;
  width_ft: number;
  height_ft: number;
  depth_ft: number;
  transform?: number[]; // 16 values, column-major (absent on pre-Path-A scans)
}

export interface RoomData {
  floor_area_sqft: number;
  wall_count: number;
  walls: RawSurface[];
  doors: RawSurface[];
  windows: RawSurface[];
  openings: RawSurface[];
  objects: RawObject[];
}

// ─── Output types ────────────────────────────────────────────────────────────

export interface LineSegment {
  x1: number; // feet
  z1: number;
  x2: number;
  z2: number;
}

export interface ObjectFootprint {
  category: string;
  cx: number;  // center x, feet
  cz: number;  // center z, feet
  width_ft: number;
  depth_ft: number;
  rotation_deg: number; // rotation around Y axis
}

export interface FloorPlan {
  walls: LineSegment[];
  doors: LineSegment[];
  windows: LineSegment[];
  openings: LineSegment[];
  objects: ObjectFootprint[];
  bounds: { min_x: number; min_z: number; max_x: number; max_z: number };
}

export interface ElevationElement {
  type: "door" | "window" | "opening" | "object";
  category?: string; // for objects
  // All in feet, origin = bottom-left of wall face
  x_ft: number;
  y_ft: number; // from floor
  width_ft: number;
  height_ft: number;
}

export interface WallElevation {
  wall_index: number;
  width_ft: number;
  height_ft: number;
  confidence: string;
  elements: ElevationElement[];
}

export interface Drawings {
  floor_plan: FloorPlan;
  wall_elevations: WallElevation[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const M_TO_FT = 3.28084;

/** Type guard — narrows surfaces/objects to those with transform data (Path A+ scans). */
function hasTransform<T extends { transform?: number[] }>(s: T): s is T & { transform: number[] } {
  return Array.isArray(s.transform) && s.transform.length === 16;
}

/** Position (x, y, z) in metres from a column-major 4×4 transform. */
function pos(t: number[]): [number, number, number] {
  return [t[12], t[13], t[14]];
}

/** Local X axis (col 0) of transform — direction along wall width. */
function axisX(t: number[]): [number, number, number] {
  return [t[0], t[1], t[2]];
}

/** Local Z axis (col 2) of transform — wall outward normal. */
function axisZ(t: number[]): [number, number, number] {
  return [t[8], t[9], t[10]];
}

function dot3(a: [number, number, number], b: [number, number, number]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function sub3(
  a: [number, number, number],
  b: [number, number, number]
): [number, number, number] {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

/**
 * Returns the two XZ endpoints of a surface (wall, door, window) in feet.
 * The surface is centred at its transform position; width runs along local X.
 */
function surfaceEndpoints(s: RawSurface & { transform: number[] }): { p1: [number, number]; p2: [number, number] } {
  const [cx, , cz] = pos(s.transform);
  const [ax, , az] = axisX(s.transform);
  const halfW = (s.width_ft / M_TO_FT) / 2; // half-width in metres

  return {
    p1: [(cx - ax * halfW) * M_TO_FT, (cz - az * halfW) * M_TO_FT],
    p2: [(cx + ax * halfW) * M_TO_FT, (cz + az * halfW) * M_TO_FT],
  };
}

function toLineSegment(s: RawSurface & { transform: number[] }): LineSegment {
  const { p1, p2 } = surfaceEndpoints(s);
  return { x1: p1[0], z1: p1[1], x2: p2[0], z2: p2[1] };
}

/** Angle (degrees) of the local X axis projected onto the XZ plane. */
function yawDeg(t: number[]): number {
  const [ax, , az] = axisX(t);
  return (Math.atan2(az, ax) * 180) / Math.PI;
}

// ─── Floor plan ──────────────────────────────────────────────────────────────

function buildFloorPlan(room: RoomData): FloorPlan {
  const walls = room.walls.filter(hasTransform).map(toLineSegment);
  const doors = room.doors.filter(hasTransform).map(toLineSegment);
  const windows = room.windows.filter(hasTransform).map(toLineSegment);
  const openings = room.openings.filter(hasTransform).map(toLineSegment);

  const objects: ObjectFootprint[] = room.objects.filter(hasTransform).map((o) => {
    const [cx, , cz] = pos(o.transform);
    return {
      category: o.category,
      cx: cx * M_TO_FT,
      cz: cz * M_TO_FT,
      width_ft: o.width_ft,
      depth_ft: o.depth_ft,
      rotation_deg: yawDeg(o.transform),
    };
  });

  // Compute bounding box over all XZ points
  const xs: number[] = [];
  const zs: number[] = [];
  for (const seg of [...walls, ...doors, ...windows, ...openings]) {
    xs.push(seg.x1, seg.x2);
    zs.push(seg.z1, seg.z2);
  }
  for (const o of objects) {
    xs.push(o.cx - o.width_ft / 2, o.cx + o.width_ft / 2);
    zs.push(o.cz - o.depth_ft / 2, o.cz + o.depth_ft / 2);
  }

  return {
    walls,
    doors,
    windows,
    openings,
    objects,
    bounds: {
      min_x: Math.min(...xs),
      min_z: Math.min(...zs),
      max_x: Math.max(...xs),
      max_z: Math.max(...zs),
    },
  };
}

// ─── Wall elevations ──────────────────────────────────────────────────────────

/**
 * Signed distance from a 3D point to the wall's plane.
 * Negative = behind the wall, positive = in front.
 */
function distToWallPlane(wallT: number[], point: [number, number, number]): number {
  const wallPos = pos(wallT);
  const normal = axisZ(wallT);
  return dot3(sub3(point, wallPos), normal);
}

/**
 * Project a 3D point onto the wall's local UV frame:
 *   U = position along wall width (horizontal, feet)
 *   V = height from bottom of wall (feet)
 */
function projectOntoWall(
  wallT: number[],
  wallHeightFt: number,
  point: [number, number, number]
): { u_ft: number; v_ft: number } {
  const wallPos = pos(wallT);
  const rel = sub3(point, wallPos); // in metres

  // U: project onto local X axis (along width), convert to feet
  const u_m = dot3(rel, axisX(wallT));

  // V: project onto Y axis (up), convert to feet, then shift so 0 = floor
  // Wall centre is at mid-height, so floor = -height_m/2 relative to centre
  const wallHeightM = wallHeightFt / M_TO_FT;
  const v_m = dot3(rel, [wallT[4], wallT[5], wallT[6]]) + wallHeightM / 2;

  return { u_ft: u_m * M_TO_FT, v_ft: v_m * M_TO_FT };
}

function buildWallElevations(room: RoomData): WallElevation[] {
  const PLANE_THRESHOLD_M = 0.20; // element centre within 20 cm of wall plane

  return room.walls.filter(hasTransform).map((wall, wallIndex) => {
    const elements: ElevationElement[] = [];

    function tryAdd(
      surfaces: RawSurface[],
      type: ElevationElement["type"],
      category?: string
    ) {
      for (const s of surfaces.filter(hasTransform)) {
        const centre = pos(s.transform);
        const dist = Math.abs(distToWallPlane(wall.transform, centre));
        if (dist > PLANE_THRESHOLD_M) continue;

        const { u_ft, v_ft } = projectOntoWall(wall.transform, wall.height_ft, centre);
        const halfW = s.width_ft / 2;
        const halfH = s.height_ft / 2;

        // Clamp to wall bounds before adding
        if (
          Math.abs(u_ft) > wall.width_ft / 2 + 0.5 ||
          v_ft < -0.5 ||
          v_ft > wall.height_ft + 0.5
        )
          continue;

        elements.push({
          type,
          ...(category ? { category } : {}),
          x_ft: u_ft - halfW, // left edge from wall centre
          y_ft: Math.max(0, v_ft - halfH), // bottom edge from floor
          width_ft: s.width_ft,
          height_ft: s.height_ft,
        });
      }
    }

    function tryAddObjects(objects: RawObject[]) {
      for (const o of objects.filter(hasTransform)) {
        const centre = pos(o.transform);
        const dist = Math.abs(distToWallPlane(wall.transform, centre));
        if (dist > o.depth_ft / M_TO_FT / 2 + PLANE_THRESHOLD_M) continue;

        const { u_ft, v_ft } = projectOntoWall(wall.transform, wall.height_ft, centre);
        if (Math.abs(u_ft) > wall.width_ft / 2 + 0.5) continue;

        elements.push({
          type: "object",
          category: o.category,
          x_ft: u_ft - o.width_ft / 2,
          y_ft: Math.max(0, v_ft - o.height_ft / 2),
          width_ft: o.width_ft,
          height_ft: o.height_ft,
        });
      }
    }

    tryAdd(room.doors, "door");
    tryAdd(room.windows, "window");
    tryAdd(room.openings, "opening");
    tryAddObjects(room.objects);

    return {
      wall_index: wallIndex,
      width_ft: wall.width_ft,
      height_ft: wall.height_ft,
      confidence: wall.confidence,
      elements,
    };
  });
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function computeDrawings(room: RoomData): Drawings {
  return {
    floor_plan: buildFloorPlan(room),
    wall_elevations: buildWallElevations(room),
  };
}
