// GCC - exact-cover edge colouring for the league-phase fixture graph.
//
// PURE TypeScript: no Firebase, no framework imports, no I/O and no hidden
// randomness. Step A builds an 8-regular graph on the 36 players: every player
// has eight matches, so a schedule is exactly a proper 8-edge-colouring of that
// graph. Each colour is one matchday and covers every player exactly once.
//
// The search is Algorithm X over a Dancing Links (DLX) matrix:
//   * one column per edge (the edge must be used exactly once), and
//   * one column per (player, colour) pair (each player plays once per day).
// A row is "edge e gets colour c" and covers three columns: the edge column and
// the two (player, colour) columns of its endpoints. A complete cover therefore
// assigns exactly one colour to every edge, with no player appearing twice in a
// colour. If the search exhausts its node budget we return `ok: false`; the
// generator retries with a derived seed instead of emitting a partial schedule.
import { FIXTURE_COLOURING_NODE_BUDGET } from "./types";

export interface ColouringEdge {
  readonly u: number;
  readonly v: number;
}

export interface EdgeColouringResult {
  readonly ok: boolean;
  /** Indexed by edge; `null` when no complete colouring was found. */
  readonly colours: readonly number[] | null;
  /** Search nodes visited (one per recursion entry). */
  readonly nodes: number;
  /** True when the node budget stopped the search before it could finish. */
  readonly budgetExhausted: boolean;
}

/**
 * Assigns one of `colourCount` colours to every edge so that no two edges of
 * the same colour share a vertex. The graph must be regular of degree
 * `colourCount`; otherwise no such colouring exists.
 */
export function findEdgeColouring(
  edges: readonly ColouringEdge[],
  vertexCount: number,
  colourCount: number,
  nodeBudget: number = FIXTURE_COLOURING_NODE_BUDGET,
): EdgeColouringResult {
  const edgeCount = edges.length;

  if (edgeCount === 0) {
    return { ok: true, colours: [], nodes: 0, budgetExhausted: false };
  }

  if (!Number.isInteger(vertexCount) || vertexCount <= 0) {
    throw new RangeError("A colouring needs a positive vertex count.");
  }

  if (!Number.isInteger(colourCount) || colourCount <= 0) {
    throw new RangeError("A colouring needs a positive colour count.");
  }

  const realColumnCount = edgeCount + vertexCount * colourCount;
  // Node 0 is the DLX root; real columns occupy 1..realColumnCount.
  const headerCount = realColumnCount + 1;
  const capacity = headerCount + edgeCount * colourCount * 3;

  const left = new Int32Array(capacity);
  const right = new Int32Array(capacity);
  const up = new Int32Array(capacity);
  const down = new Int32Array(capacity);
  const columnOf = new Int32Array(capacity);
  const rowOf = new Int32Array(capacity);
  const size = new Int32Array(headerCount);

  for (let column = 0; column < headerCount; column += 1) {
    left[column] = column === 0 ? realColumnCount : column - 1;
    right[column] = column === realColumnCount ? 0 : column + 1;
    up[column] = column;
    down[column] = column;
    columnOf[column] = column;
    rowOf[column] = -1;
    size[column] = 0;
  }

  let nextNode = headerCount;

  function addRow(row: number, columns: readonly number[]): void {
    let first = -1;

    for (const realColumn of columns) {
      const column = realColumn + 1;
      const node = nextNode;
      nextNode += 1;

      columnOf[node] = column;
      rowOf[node] = row;
      up[node] = up[column];
      down[node] = column;
      down[up[column]] = node;
      up[column] = node;
      size[column] += 1;

      if (first === -1) {
        first = node;
        left[node] = node;
        right[node] = node;
      } else {
        left[node] = left[first] as number;
        right[node] = first;
        right[left[first] as number] = node;
        left[first] = node;
      }
    }
  }

  for (let edge = 0; edge < edgeCount; edge += 1) {
    const { u, v } = edges[edge] as ColouringEdge;

    for (let colour = 0; colour < colourCount; colour += 1) {
      // Row id is edge * colourCount + colour; the colour is row % colourCount.
      addRow(edge * colourCount + colour, [
        edge,
        edgeCount + u * colourCount + colour,
        edgeCount + v * colourCount + colour,
      ]);
    }
  }

  const solution: number[] = [];
  let nodes = 0;
  let budgetExhausted = false;

  function cover(column: number): void {
    right[left[column] as number] = right[column] as number;
    left[right[column] as number] = left[column] as number;

    for (let row = down[column]; row !== column; row = down[row] as number) {
      for (let node = right[row]; node !== row; node = right[node] as number) {
        down[up[node] as number] = down[node] as number;
        up[down[node] as number] = up[node] as number;
        size[columnOf[node] as number] -= 1;
      }
    }
  }

  function uncover(column: number): void {
    for (let row = up[column]; row !== column; row = up[row] as number) {
      for (let node = left[row]; node !== row; node = left[node] as number) {
        size[columnOf[node] as number] += 1;
        down[up[node] as number] = node;
        up[down[node] as number] = node;
      }
    }

    right[left[column] as number] = column;
    left[right[column] as number] = column;
  }

  function search(): boolean {
    nodes += 1;

    if (nodes > nodeBudget) {
      budgetExhausted = true;
      return false;
    }

    if (right[0] === 0) {
      return true;
    }

    // Minimum-remaining-values heuristic: cover the tightest open column.
    let column = right[0] as number;
    let bestSize = size[column] as number;

    for (let candidate = right[column]; candidate !== 0; candidate = right[candidate] as number) {
      const candidateSize = size[candidate] as number;

      if (candidateSize < bestSize) {
        column = candidate;
        bestSize = candidateSize;
      }
    }

    if (bestSize === 0) {
      return false;
    }

    cover(column);

    for (let row = down[column]; row !== column; row = down[row] as number) {
      solution.push(rowOf[row] as number);

      for (let node = right[row]; node !== row; node = right[node] as number) {
        cover(columnOf[node] as number);
      }

      if (search()) {
        return true;
      }

      for (let node = left[row]; node !== row; node = left[node] as number) {
        uncover(columnOf[node] as number);
      }

      solution.pop();

      if (budgetExhausted) {
        break;
      }
    }

    uncover(column);
    return false;
  }

  const ok = search();

  if (!ok || solution.length !== edgeCount) {
    return { ok: false, colours: null, nodes, budgetExhausted };
  }

  const colours = new Array<number>(edgeCount).fill(-1);

  for (const row of solution) {
    const edge = Math.floor(row / colourCount);
    const colour = row % colourCount;
    colours[edge] = colour;
  }

  return { ok: true, colours, nodes, budgetExhausted: false };
}
