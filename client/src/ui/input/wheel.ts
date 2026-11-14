// A wheel's geometry: its items stand evenly round a circle, the first at the top and the rest
// clockwise, and each owns the wedge of screen around it.

/** Where item `index` of `count` stands: degrees clockwise from the top. */
export const wedgeAngle = (index: number, count: number) => (index / count) * 360;

/**
 * Whose wedge a point is in, given how far it is from the wheel's centre (px, y down). -1 inside
 * the hub (closer than `hub` px), where moving the pointer picks nothing.
 */
export function wedgeAt(dx: number, dy: number, count: number, hub: number): number {
  if (count <= 0 || Math.hypot(dx, dy) < hub) return -1;
  // atan2(dx, -dy): 0 at the top, growing clockwise
  const turn = (Math.atan2(dx, -dy) / (Math.PI * 2) + 1) % 1;
  return Math.round(turn * count) % count;
}
