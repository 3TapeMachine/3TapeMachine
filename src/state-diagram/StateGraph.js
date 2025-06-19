/**
 * Use a transition table to derive the graph (vertices & edges) for a D3 diagram.
 */
function deriveGraph(table) {
  console.log("--- Starting deriveGraph ---"); // DEBUG
  const graph = Object.fromEntries(
    Object.entries(table).map(([state, transitions]) => [
      state,
      { label: state, transitions },
    ])
  );

  const allEdges = [];
  Object.entries(graph).forEach(([state, vertex]) => {
    console.log(`Processing state: "${state}"`); // DEBUG

    if (!vertex.transitions) {
      console.log(` -> State "${state}" has no transitions. Skipping.`); // DEBUG
      return;
    }

    vertex.transitions = (() => {
      const stateTransitions = {};
      const cache = {};

      function edgeTo(target, label) {
        console.log(`  -> Trying to create edge to: "${target}"`); // DEBUG
        if (!graph[target]) {
          console.error(`  -> ERROR: Target state "${target}" does not exist in the graph! Edge cannot be created.`); // DEBUG
          return null; // Return null if target is invalid
        }

        if (!cache[target]) {
          cache[target] = { source: vertex, target: graph[target], labels: [] };
          allEdges.push(cache[target]);
          console.log(`  -> Successfully created new edge to "${target}"`); // DEBUG
        }
        cache[target].labels.push(label);
        return cache[target];
      }

      if (Array.isArray(vertex.transitions)) {
        // 3-tape machine logic
        vertex.transitions.forEach(item => {
          const instruct = item.instruction;
          const symbolKey = item.pattern;
          const target = instruct.next || state;
          edgeTo(target, labelFor3Tape(symbolKey, instruct));
          stateTransitions[symbolKey] = { instruction: instruct }; // Edge is handled by edgeTo
        });
      } else {
        // 1-tape machine logic
        Object.entries(vertex.transitions).forEach(([symbolKey, instruct]) => {
          if (instruct === null) return;
          const target = instruct.state || state;
          edgeTo(target, labelFor1Tape(symbolKey, instruct));
          stateTransitions[symbolKey] = { instruction: normalize(state, symbolKey, instruct) }; // Edge is handled by edgeTo
        });
      }

      return stateTransitions;
    })();
  });

  console.log("--- Finished deriveGraph ---"); // DEBUG
  console.log("Total edges created:", allEdges.length); // DEBUG
  return { graph, edges: allEdges };
}

// ... The rest of the file is the same as before ...

function normalize(state, symbol, instruction) {
  return { state, symbol, ...instruction };
}
function labelFor1Tape(symbol, action) {
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
    // This function needs to be fixed to work with the new structure from deriveGraph
    const vertex = this.__graph[state];
    if (vertex === undefined || !vertex.transitions) { return null; }
    
    // The new structure needs a new lookup. We'll simplify for now.
    // The full animated lookup needs more work, but let's get it running first.
    // This is a temporary simplification to test the graph creation.
    return null; // For now, we focus on fixing the graph drawing.
  }
}