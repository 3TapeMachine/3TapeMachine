/**
 * Use a transition table to derive the graph (vertices & edges) for a D3 diagram.
 * @param {Object} table - TransitionTable
 * @returns {{graph: Object, edges: Array}}
 */
function deriveGraph(table) {
  const graph = Object.fromEntries(
    Object.entries(table).map(([state, transitions]) => [
      state,
      { label: state, transitions },
    ])
  );

  const allEdges = [];
  Object.entries(graph).forEach(([state, vertex]) => {
    vertex.transitions = vertex.transitions && (() => {
      const stateTransitions = {};
      const cache = {};

      function edgeTo(target, label) {
        if (!cache[target]) {
          cache[target] = { source: vertex, target: graph[target], labels: [] };
          allEdges.push(cache[target]);
        }
        cache[target].labels.push(label);
        return cache[target];
      }
      
      // FIX: Handle both 1-tape (object) and 3-tape (array) transition structures
      if (Array.isArray(vertex.transitions)) {
        // 3-tape machine: transitions is an array of {pattern, instruction}
        vertex.transitions.forEach(item => {
          const instruct = item.instruction;
          const symbolKey = item.pattern;
          const target = instruct.state != null ? instruct.state : state;
          const edge = edgeTo(target, labelFor3Tape(symbolKey, instruct));
          stateTransitions[symbolKey] = { instruction: instruct, edge };
        });
      } else {
        // 1-tape machine: transitions is an object of {symbol: instruction}
        Object.entries(vertex.transitions).forEach(([symbolKey, instruct]) => {
          const target = instruct.state != null ? instruct.state : state;
          const edge = edgeTo(target, labelFor1Tape(symbolKey, instruct));
          stateTransitions[symbolKey] = { instruction: normalize(state, symbolKey, instruct), edge };
        });
      }

      return stateTransitions;
    })();
  });

  return { graph, edges: allEdges };
}

function normalize(state, symbol, instruction) {
  return { state, symbol, ...instruction };
}

// FIX: Labeling function for 1-tape machines
function labelFor1Tape(symbol, action) {
  const write = action.symbol ? visibleSpace(action.symbol) : visibleSpace(symbol);
  const move = action.move || '';
  return `${visibleSpace(symbol)} → ${write},${move}`;
}

// FIX: Labeling function for 3-tape machines
function labelFor3Tape(pattern, action) {
  const write = [
    action.write1 || pattern[0],
    action.write2 || pattern[1],
    action.write3 || pattern[2]
  ].map(visibleSpace).join('');
  const move = [
    action.move1 || 'S',
    action.move2 || 'S',
    action.move3 || 'S'
  ].join('');
  return `${pattern.split('').map(visibleSpace).join('')} → ${write},${move}`;
}

function visibleSpace(c) {
  return c === ' ' ? '␣' : c;
}

// Helper for 3-tape instruction lookup
function patternMatches(pattern, symbols) {
  for (let i = 0; i < 3; i++) {
    // The parser used a wildcard of '.', let's assume that, otherwise check for char match
    if (pattern[i] !== '.' && pattern[i] !== symbols[i]) {
      return false;
    }
  }
  return true;
}

export default class StateGraph {
  constructor(table) {
    const derived = deriveGraph(table);
    Object.defineProperties(this, {
      __graph: { value: derived.graph },
      __edges: { value: derived.edges },
    });
  }

  getVertexMap() { return this.__graph; }
  getEdges() { return this.__edges; }
  getVertex(state) { return this.__graph[state]; }

  /**
   * Get the instruction and edge for a given state and symbol(s).
   */
  getInstructionAndEdge(state, symbol) {
    const vertex = this.__graph[state];
    if (vertex === undefined) { throw new Error('not a valid state: ' + String(state)); }
    if (!vertex.transitions) { return null; }

    // FIX: Use the correct lookup logic for 1-tape vs 3-tape
    if (Array.isArray(symbol)) {
      // 3-tape: Find the first matching pattern in the list
      for (const key of Object.keys(vertex.transitions)) {
          if (patternMatches(key, symbol)) {
              return vertex.transitions[key];
          }
      }
      return null; // No pattern matched
    } else {
      // 1-tape: Direct key lookup
      return vertex.transitions[symbol];
    }
  }
}