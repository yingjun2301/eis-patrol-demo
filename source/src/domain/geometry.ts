import type { Point, RouteOrder } from "./model";
export const region = { x: 290, y: 265, width: 330, height: 290 };
const clockwise: Point[] = [
  { x: 320, y: 500 },
  { x: 320, y: 305 },
  { x: 450, y: 305 },
  { x: 450, y: 500 },
  { x: 585, y: 500 },
  { x: 585, y: 305 },
];
export function patrolPoints(order: RouteOrder): Point[] {
  return order === "forward" ? [...clockwise] : [...clockwise].reverse();
}
export function routePoints(order: RouteOrder): Point[] {
  // Simulated approach follows the western and northern access lanes.
  // Reversing the patrol must not introduce a diagonal across container stacks.
  const approach =
    order === "forward"
      ? [{ x: 265, y: 500 }]
      : [
          { x: 265, y: 250 },
          { x: 585, y: 250 },
        ];
  return [
    { x: 225, y: 470 },
    { x: 265, y: 470 },
    ...approach,
    ...patrolPoints(order),
  ];
}
export function routePosition(
  points: Point[],
  progress: number,
): { position: Point; trail: Point[] } {
  const lengths = points
    .slice(1)
    .map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y));
  let distance =
    (lengths.reduce((a, b) => a + b, 0) *
      Math.max(0, Math.min(100, progress))) /
    100;
  const trail = [points[0]];
  for (let i = 0; i < lengths.length; i++) {
    if (distance > lengths[i]) {
      distance -= lengths[i];
      trail.push(points[i + 1]);
      continue;
    }
    const t = lengths[i] === 0 ? 0 : distance / lengths[i];
    const position = {
      x: points[i].x + (points[i + 1].x - points[i].x) * t,
      y: points[i].y + (points[i + 1].y - points[i].y) * t,
    };
    return { position, trail: [...trail, position] };
  }
  return { position: points.at(-1)!, trail: points };
}
export const pointsAttr = (pts: Point[]) =>
  pts.map((p) => p.x + "," + p.y).join(" ");
