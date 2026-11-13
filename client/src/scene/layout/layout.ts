// Where everything on and around the table goes. The same in every
// environment: an environment changes how things look, never where they are.
// Plain numbers (no three.js), so it's easy to test.

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}
/** A spot for a prop: where it stands and which way it faces (rotation about y). */
export interface Anchor {
  position: Vec3;
  yaw: number;
}

const vec = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

const TABLE = { y: 0.8, rx: 1.95, rz: 1.3 } as const;
const SEATS = { rx: 2.38, rz: 1.74 } as const;

export interface Seat {
  x: number;
  z: number;
  /** rotation.y that points the seat's local +z at the middle of the table. */
  facing: number;
  /** A point on the felt, `f` of the way from the middle towards this seat. */
  toward(f: number): Vec3;
  /** The seat's local +x (its right hand), flat on the floor. */
  side: Vec3;
}

/**
 * Slot -1 is the dealer at the head of the table. Everyone else is spread
 * evenly around the rest of it, so the table re-arranges as people join.
 */
function seat(slot: number, count: number): Seat {
  const angle = slot < 0 ? Math.PI : Math.PI + ((slot + 1) * 2 * Math.PI) / (Math.max(count, 1) + 1);
  const x = Math.cos(angle) * SEATS.rx;
  const z = Math.sin(angle) * SEATS.rz;
  const facing = Math.atan2(-x, -z);
  return { x, z, facing, toward: (f) => vec(x * f, TABLE.y, z * f), side: vec(Math.cos(facing), 0, -Math.sin(facing)) };
}

export const layout = {
  table: TABLE,
  seat,
  /** Where a seat's card lies; yours sits closer so it's in reach. */
  card(slot: number, count: number, mine: boolean): Anchor {
    const s = seat(slot, count);
    const p = s.toward(mine ? 0.42 : 0.62);
    return { position: vec(p.x, p.y + 0.004, p.z), yaw: s.facing + Math.PI };
  },
  /** Where a seat's chip stack stands, just to the left of their card. */
  stack(slot: number, count: number): Vec3 {
    const s = seat(slot, count);
    const p = s.toward(0.7);
    return vec(p.x - s.side.x * 0.24, p.y - s.side.y * 0.24, p.z - s.side.z * 0.24);
  },
  anchors: {
    /** The ticket, as a sheet of paper on the felt. */
    ticket: { position: vec(-0.15, TABLE.y + 0.003, 0), yaw: 0 },
    pot: { position: vec(0.55, TABLE.y, 0), yaw: 0 },
    /** Something on the felt to click for a squeak. */
    squeaky: { position: vec(0.3, TABLE.y, 0.42), yaw: -0.8 },
    /** A screen behind the dealer showing the ticket and the round's progress. */
    statusScreen: { position: vec(-4.62, 1.95, 0.9), yaw: Math.PI / 2 + 0.25 },
    /** The big sign behind the far end of the table, facing the dealer. */
    sign: { position: vec(4.95, 2.2, 0), yaw: -Math.PI / 2 },
    /** The light over the table hangs from here. */
    lamp: { position: vec(0, 3.2, 0), yaw: 0 },
  } satisfies Record<string, Anchor>,
  cameras: {
    /** Your eyes: just behind your seat, a little higher for the dealer. */
    seat: (x: number, z: number, dealer: boolean) => vec(x * 1.06, dealer ? 1.6 : 1.5, z * 1.06),
    /** What a seated camera looks at before you drag it around. */
    lookAt: vec(0, TABLE.y + 0.1, 0),
  },
};

export type Layout = typeof layout;
