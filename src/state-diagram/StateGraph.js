/**
 * Use a transition table to derive the graph (vertices & edges) for a D3 diagram.
 * Edges with the same source and target are combined.
 * @param {Object} table - TransitionTable
 * @returns {{graph: Object, edges: Array}}
 */
function deriveGraph(table) {
  // 1. Create all the vertices.
  const graph = Object.fromEntries(
    Object.entries(table).map(([state, transitions]) => [
      state,
      { label: state, transitions },
    ])
  );

  // 2. Create the edges, which can now point at any vertex object.
  const allEdges = [];
  Object.entries(graph).forEach(([state, vertex]) => {
    vertex.transitions = vertex.transitions && (() => {
      const stateTransitions = {};
      const cache = {};

      function edgeTo(target, label) {
        if (!cache[target]) {
          cache[target] = {
            source: vertex,
            target: graph[target],
            labels: [],
          };
          allEdges.push(cache[target]);
        }
        cache[target].labels.push(label);
        return cache[target];
      }

      Object.entries(vertex.transitions).forEach(([symbolKey, instruct]) => {
        const symbols = symbolKey.split(',');
        const target = instruct.state != null ? instruct.state : state;
        const edge = edgeTo(target, labelFor(symbols, instruct));

        stateTransitions[symbolKey] = {
          instruction: normalize(state, symbols, instruct),
          edge,
        };
      });

      return stateTransitions;
    })();
  });

  return { graph, edges: allEdges };
}

// Normalize an instruction to include an explicit state and symbol.
function normalize(state, symbol, instruction) {
  return { state, symbol, ...instruction };
}

/**
 * FIX: This function is updated to be more robust. It checks if action.write
 * and action.move are arrays before attempting to call .join() on them.
 */
function labelFor(symbols, action) {
  const writeSymbols = Array.isArray(action.write)
    ? action.write.map(visibleSpace).join(',')
    : action.write || symbols.map(visibleSpace).join(',');

  const moveSymbols = Array.isArray(action.move)
    ? action.move.join(',')
    : action.move || '';

  const rightSide = writeSymbols + ',' + moveSymbols;
  return symbols.map(visibleSpace).join(',') + '→' + rightSide;
}


// replace ' ' with '␣'.
function visibleSpace(c) {
  return c === ' ' ? '␣' : c;
}

/**
 * Aids rendering and animating a transition table in D3.
 */
export default class StateGraph {
  constructor(table) {
    const derived = deriveGraph(table);
    Object.defineProperties(this, {
      __graph: { value: derived.graph },
      __edges: { value: derived.edges },
    });
  }

  getVertexMap() {
    return this.__graph;
  }

  getEdges() {
    return this.__edges;
  }

  getVertex(state) {
    return this.__graph[state];
  }

  getInstructionAndEdge(state, symbol) {
    const vertex = this.__graph[state];
    if (vertex === undefined) {
      throw new Error('not a valid state: ' + String(state));
    }
    const key = Array.isArray(symbol) ? symbol.join(',') : symbol;
    return vertex.transitions && vertex.transitions[key];
  }
}