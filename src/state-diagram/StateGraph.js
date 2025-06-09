/**
 * Use a transition table to derive the graph (vertices & edges) for a D3 diagram.
 * Edges with the same source and target are combined.
 * NB. In addition to single symbols, comma-separated symbols are supported.
 * e.g. symbol string '0,1,,,I' -> symbols [0,1,',','I'].
 * @param {Object} table - TransitionTable
 * @returns {{graph: Object, edges: Array}}
 */
function deriveGraph(table) {
  // 1. Create all the vertices.
  const graph = Object.fromEntries(
    Object.entries(table).map(([state, transitions]) => [
      state,
      { label: state, transitions }
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
            labels: []
          };
          allEdges.push(cache[target]);
        }
        cache[target].labels.push(label);
        return cache[target];
      }

      Object.entries(vertex.transitions).forEach(([symbolKey, instruct]) => {
        // Handle comma-separated symbols.
        // Recreate array by splitting on ','. Treat 2 consecutive ',' as , ','.
        const symbols = symbolKey.split(',').reduce((acc, x) => {
          if (x === '' && acc[acc.length - 1] === '') {
            acc[acc.length - 1] = ',';
          } else {
            acc.push(x);
          }
          return acc;
        }, []);
        const target = instruct.state != null ? instruct.state : state;
        const edge = edgeTo(target, labelFor(symbols, instruct));

        symbols.forEach(symbol => {
          stateTransitions[symbol] = {
            instruction: normalize(state, symbol, instruct),
            edge
          };
        });
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

function labelFor(symbols, action) {
  const rightSide =
    (action.symbol == null ? '' : visibleSpace(String(action.symbol)) + ',') +
    String(action.move);
  return symbols.map(visibleSpace).join(',') + '→' + rightSide;
}

// replace ' ' with '␣'.
function visibleSpace(c) {
  return c === ' ' ? '␣' : c;
}

/**
 * Aids rendering and animating a transition table in D3.
 *
 * • Generates the vertices and edges ("nodes" and "links") for a D3 diagram.
 * • Provides mapping of each state to its vertex and each transition to its edge.
 * @param {Object} table - TransitionTable
 */
export default class StateGraph {
  constructor(table) {
    const derived = deriveGraph(table);
    Object.defineProperties(this, {
      __graph: { value: derived.graph },
      __edges: { value: derived.edges }
    });
  }

  /**
   * Returns the mapping from states to vertices (D3 layout "nodes").
   * @return { {[state: string]: Object} }
   */
  getVertexMap() {
    return this.__graph;
  }

  /**
   * D3 layout "links".
   */
  getEdges() {
    return this.__edges;
  }

  /**
   * Look up a state's corresponding D3 "node".
   */
  getVertex(state) {
    return this.__graph[state];
  }

  /**
   * Get the instruction and edge for a given state and symbol.
   */
  getInstructionAndEdge(state, symbol) {
    const vertex = this.__graph[state];
    if (vertex === undefined) {
      throw new Error('not a valid state: ' + String(state));
    }
    return vertex.transitions && vertex.transitions[symbol];
  }
}
