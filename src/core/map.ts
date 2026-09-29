import type { Rng } from './rng';

export type NodeType = 'fight' | 'elite' | 'rest' | 'shop' | 'event' | 'boss';

export interface MapNode {
  id: string;
  floor: number;
  /** Column 0..MAP_LANES-1 (the boss sits in the middle). */
  lane: number;
  type: NodeType;
  /** Ids of the nodes this one leads to. */
  next: string[];
}

/** An act's map: floors from 0 (start) up to the boss. Plain data for saving. */
export interface MapState {
  nodes: Record<string, MapNode>;
  floors: number;
  bossId: string;
}

export const MAP_FLOORS = 10;
export const MAP_LANES = 4;
const PATHS = 4;
export const BOSS_ID = 'boss';

/** Weights for random node types; each non-fight type has a first floor (below). */
const TYPE_WEIGHTS: [NodeType, number][] = [
  ['fight', 5],
  ['elite', 1.5],
  ['rest', 1.5],
  ['shop', 1.5],
  ['event', 2.5],
];
const ELITE_FROM = 3;
const SHOP_FROM = 2;
const EVENT_FROM = 1;

const nodeId = (floor: number, lane: number) => `${floor}-${lane}`;

/**
 * Builds a map from a few random paths that start at the bottom and step up one
 * floor at a time, moving at most one lane sideways and never crossing another
 * path. Every node is reachable from floor 0 and leads to the boss.
 */
export function generateMap(rng: Rng): MapState {
  const nodes: Record<string, MapNode> = {};
  const edges: [number, number, number][] = []; // [floor, fromLane, toLane]

  const ensure = (floor: number, lane: number): MapNode => {
    const id = nodeId(floor, lane);
    const existing = nodes[id];
    if (existing) return existing;
    const node: MapNode = { id, floor, lane, type: 'fight', next: [] };
    nodes[id] = node;
    return node;
  };
  const crosses = (floor: number, from: number, to: number) =>
    edges.some(([f, a, b]) => f === floor && ((from < a && to > b) || (from > a && to < b)));

  // At least two different starting lanes.
  const starts = Array.from({ length: PATHS }, () => rng.int(0, MAP_LANES - 1));
  if (new Set(starts).size === 1) starts[1] = ((starts[0] ?? 0) + 2) % MAP_LANES;

  for (const start of starts) {
    let lane = start;
    for (let floor = 0; floor < MAP_FLOORS; floor++) {
      const node = ensure(floor, lane);
      if (floor === MAP_FLOORS - 1) break;
      const options = rng.shuffle([lane - 1, lane, lane + 1].filter((l) => l >= 0 && l < MAP_LANES));
      // Going straight never crosses, so there is always an option.
      const to = options.find((l) => !crosses(floor, lane, l)) ?? lane;
      if (!edges.some(([f, a, b]) => f === floor && a === lane && b === to)) edges.push([floor, lane, to]);
      const nextId = nodeId(floor + 1, to);
      if (!node.next.includes(nextId)) node.next.push(nextId);
      lane = to;
    }
  }

  nodes[BOSS_ID] = { id: BOSS_ID, floor: MAP_FLOORS, lane: (MAP_LANES - 1) / 2, type: 'boss', next: [] };
  for (const node of Object.values(nodes)) {
    if (node.floor === MAP_FLOORS - 1) node.next = [BOSS_ID];
    node.next.sort();
  }

  assignTypes(nodes, rng);
  return { nodes, floors: MAP_FLOORS, bossId: BOSS_ID };
}

/**
 * First floor: fights. Last floor before the boss: rest sites. Elsewhere random,
 * without two rests, shops, events or elites in a row on the same path.
 */
function assignTypes(nodes: Record<string, MapNode>, rng: Rng): void {
  const parents = new Map<string, MapNode[]>();
  for (const node of Object.values(nodes)) {
    for (const id of node.next) parents.set(id, [...(parents.get(id) ?? []), node]);
  }
  const byFloor = Object.values(nodes).sort((a, b) => a.floor - b.floor || a.lane - b.lane);
  for (const node of byFloor) {
    if (node.type === 'boss') continue;
    if (node.floor === 0) node.type = 'fight';
    else if (node.floor === MAP_FLOORS - 1) node.type = 'rest';
    else {
      const parentTypes = new Set((parents.get(node.id) ?? []).map((p) => p.type));
      const allowed = TYPE_WEIGHTS.filter(([type]) => {
        if (type === 'fight') return true;
        if (parentTypes.has(type)) return false;
        if (type === 'shop') return node.floor >= SHOP_FROM;
        if (type === 'event') return node.floor >= EVENT_FROM;
        return node.floor >= ELITE_FROM;
      });
      node.type = weightedPick(rng, allowed);
    }
  }
}

function weightedPick(rng: Rng, options: [NodeType, number][]): NodeType {
  const total = options.reduce((sum, [, w]) => sum + w, 0);
  let roll = rng.next() * total;
  for (const [type, weight] of options) {
    roll -= weight;
    if (roll < 0) return type;
  }
  return options[options.length - 1]?.[0] ?? 'fight';
}

/** Nodes the player can move to: floor 0 at the start, otherwise the current node's next nodes. */
export function reachableNodes(map: MapState, currentId: string | null): MapNode[] {
  if (currentId === null) return Object.values(map.nodes).filter((n) => n.floor === 0);
  return (map.nodes[currentId]?.next ?? []).flatMap((id) => (map.nodes[id] ? [map.nodes[id]] : []));
}
