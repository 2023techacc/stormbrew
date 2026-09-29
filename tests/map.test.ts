import { describe, expect, it } from 'vitest';
import { BOSS_ID, MAP_FLOORS, MAP_LANES, generateMap, reachableNodes, type MapState } from '../src/core/map';
import { Rng } from '../src/core/rng';

const maps: MapState[] = Array.from({ length: 30 }, (_, seed) => generateMap(new Rng(seed)));
const regular = (map: MapState) => Object.values(map.nodes).filter((n) => n.id !== BOSS_ID);

describe('map generation', () => {
  it('is deterministic for the same seed', () => {
    expect(generateMap(new Rng(7))).toEqual(generateMap(new Rng(7)));
  });

  it('has nodes on every floor, inside the lanes, plus the boss on top', () => {
    for (const map of maps) {
      for (let floor = 0; floor < MAP_FLOORS; floor++) {
        expect(regular(map).some((n) => n.floor === floor)).toBe(true);
      }
      for (const node of regular(map)) {
        expect(node.lane).toBeGreaterThanOrEqual(0);
        expect(node.lane).toBeLessThan(MAP_LANES);
      }
      expect(map.nodes[BOSS_ID]?.type).toBe('boss');
      expect(map.nodes[BOSS_ID]?.floor).toBe(MAP_FLOORS);
    }
  });

  it('only connects to the next floor, at most one lane sideways', () => {
    for (const map of maps) {
      for (const node of regular(map)) {
        for (const id of node.next) {
          const to = map.nodes[id];
          expect(to?.floor).toBe(node.floor + 1);
          if (to && to.id !== BOSS_ID) expect(Math.abs(to.lane - node.lane)).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('has no crossing paths', () => {
    for (const map of maps) {
      const edges = regular(map).flatMap((n) =>
        n.next.filter((id) => id !== BOSS_ID).map((id) => [n.floor, n.lane, map.nodes[id]?.lane ?? -1] as const),
      );
      for (const [f, a, b] of edges) {
        for (const [g, c, d] of edges) {
          if (f === g) expect((a < c && b > d) || (a > c && b < d)).toBe(false);
        }
      }
    }
  });

  it('every node is reachable from the start and leads to the boss', () => {
    for (const map of maps) {
      const seen = new Set<string>();
      const queue = reachableNodes(map, null).map((n) => n.id);
      while (queue.length) {
        const id = queue.pop() as string;
        if (seen.has(id)) continue;
        seen.add(id);
        queue.push(...(map.nodes[id]?.next ?? []));
      }
      expect(seen.size).toBe(Object.keys(map.nodes).length);
      for (const node of regular(map)) expect(node.next.length).toBeGreaterThan(0);
    }
  });

  it('starts with fights, ends with rest sites, and has elites, rests and shops only from their floors', () => {
    for (const map of maps) {
      for (const node of regular(map)) {
        if (node.floor === 0) expect(node.type).toBe('fight');
        else if (node.floor === MAP_FLOORS - 1) expect(node.type).toBe('rest');
        if (node.floor < 3) expect(['elite', 'rest']).not.toContain(node.type);
        if (node.floor < 2) expect(node.type).not.toBe('shop');
      }
    }
  });

  it('never puts two rests, shops, events or elites in a row (below the last floor)', () => {
    for (const map of maps) {
      for (const node of regular(map)) {
        if (node.type === 'fight') continue;
        for (const id of node.next) {
          const to = map.nodes[id];
          if (to && to.floor < MAP_FLOORS - 1) expect(to.type).not.toBe(node.type);
        }
      }
    }
  });

  it('mixes in every kind of node across maps', () => {
    const types = new Set(maps.flatMap((m) => Object.values(m.nodes).map((n) => n.type)));
    expect([...types].sort()).toEqual(['boss', 'elite', 'event', 'fight', 'rest', 'shop']);
  });
});
