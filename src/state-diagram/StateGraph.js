function deriveGraph(table) {
  const graph = Object.fromEntries(
    Object.entries(table).map(([state, transitions]) => [
      state,
      { label: state, transitions },
    ])
  );

  const allEdges = [];
  Object.entries(graph).forEach(([state, vertex]) => {
    if (!vertex.transitions) { return; } 

    const stateTransitions = {};
    const cache = {};

    function edgeTo(target, label) {
      if (!graph[target]) {
        console.error(`Attempted to create an edge to a non-existent state: "${target}"`);
        return null;
      }
      if (!cache[target]) {
        cache[target] = { source: vertex, target: graph[target], labels: [] };
        allEdges.push(cache[target]);
      }
      cache[target].labels.push(label);
      return cache[target];
    }

    if (Array.isArray(vertex.transitions)) {
      // 3-tape machine: transitions is an ARRAY of {pattern, instruction} objects
      vertex.transitions.forEach(item => {
        const instruct = item.instruction;
        const pattern = item.pattern;
        const target = instruct.next || state;
        const edge = edgeTo(target, labelFor3Tape(pattern, instruct));
        stateTransitions[pattern] = { instruction: instruct, edge };
      });
    } else {
      // 1-tape machine: transitions is an OBJECT of {symbol: instruction}
      Object.entries(vertex.transitions).forEach(([symbolKey, instruct]) => {
        if (instruct === null) return;
        const target = instruct.state || state;
        const edge = edgeTo(target, labelFor1Tape(symbolKey, instruct));
        // FIX: Store the instruction directly from the parser without modification.
        stateTransitions[symbolKey] = { instruction: instruct, edge };
      });
    }
    vertex.transitions = stateTransitions;
  });

  return { graph, edges: allEdges };
}

// The problematic 'normalize' function has been removed.

function labelFor1Tape(symbol, action) {
  // This function now correctly refers to 'action.symbol' for the write character,
  // which is what the parser provides for instructions like {write: 0, L}.
  const write = action.symbol ? visibleSpace(action.symbol) : visibleSpace(symbol);
  const move = action.move || '';
  return `${visibleSpace(symbol)} → ${write},${move}`;
}

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

function visibleSpace(c) { return c === ' ' ? '␣' : c; }

function patternMatches(pattern, symbols) {
  for (let i = 0; i < 3; i++) {
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

  getInstructionAndEdge(state, symbol) {
    const vertex = this.__graph[state];
    if (vertex === undefined || !vertex.transitions) { return null; }
    
    if (Array.isArray(symbol)) {
      // 3-tape: Find the first matching pattern in the transition object.
      for (const patternKey in vertex.transitions) {
        if (patternMatches(patternKey, symbol)) {
          return vertex.transitions[patternKey];
        }
      }
      return null;
    } else {
      // 1-tape: Direct key lookup
      return vertex.transitions[symbol];
    }
  }
}