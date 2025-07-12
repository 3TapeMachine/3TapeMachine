import { TuringMachine1Tape } from './TuringMachine1Tape.js';
import { TuringMachine3Tape } from './TuringMachine3Tape.js';
import TapeViz from './tape/TapeViz.js';
import StateGraph from './state-diagram/StateGraph.js';
import StateViz from './state-diagram/StateViz.js';
import { watchInit } from './watch.js';
import * as d3 from 'd3';

// ... (all helper functions are unchanged)
function animatedTransition(graph, animationCallback) {
  return function (state, symbol) {
    const tuple = graph.getInstructionAndEdge(state, symbol);
    if (tuple == null) return null;
    animationCallback(tuple.edge);
    return tuple.instruction;
  };
}
function animatedMultiTapeTransition(graph, animationCallback) {
  return function (state, symbols) {
    const tuple = graph.getInstructionAndEdge(state, symbols);
    if (tuple == null) return null;
    animationCallback(tuple.edge);
    return tuple.instruction;
  };
}
function pulseEdge(edge) {
  const edgepath = d3.select(edge.domNode);
  return edgepath
    .classed('active-edge', true)
    .transition()
    .style('stroke-width', '3px')
    .transition()
    .style('stroke-width', '1px')
    .transition()
    .duration(0)
    .on('start', function () {
      // eslint-disable-next-line no-invalid-this
      d3.select(this).classed('active-edge', false);
    })
    .style('stroke', null)
    .style('stroke-width', null);
}
function addTape(div, spec) {
  return new TapeViz(
    div.append('svg').attr('class', 'tm-tape'),
    9,
    spec.blank,
    spec.input ? String(spec.input).split('') : []
  );
}
function addBlankTape(div, spec) {
  return new TapeViz(
    div.append('svg').attr('class', 'tm-tape'),
    9,
    spec.blank,
    []
  );
}

export default class TMViz {
  constructor(div, spec, posTable) {
    div = d3.select(div);
    const graph = new StateGraph(spec.table);
    this.stateviz = new StateViz(
      div,
      graph.getVertexMap(),
      graph.getEdges()
    );
    if (posTable !== undefined) {
      this.positionTable = posTable;
    }

    this.edgeAnimation = pulseEdge;
    this.stepInterval = 100;
    this.__parentDiv = div;
    this.__spec = spec;

    const animateAndContinue = edge => {
      const transition = this.edgeAnimation(edge);
      if (this.isRunning) {
        transition.transition().duration(this.stepInterval).on('end', () => {
          if (this.isRunning) this.step();
        });
      }
    };
    
    // FIX: Check for '3tape' specifically and default everything else to 1-tape.
    // This makes the existing examples work again.
    if (spec.type === '3tape') {
      const tapes = [
        addTape(div, spec),
        addBlankTape(div, spec),
        addBlankTape(div, spec),
      ];
      this.machine = new TuringMachine3Tape(
        animatedMultiTapeTransition(graph, animateAndContinue),
        spec.startState,
        tapes,
        spec.wild
      );
    } else {
      // Default to a 1-tape machine for all other cases
      this.machine = new TuringMachine1Tape(
        animatedTransition(graph, animateAndContinue),
        spec.startState,
        addTape(div, spec)
      );
    }

    watchInit(this.machine, 'state', (prop, oldstate, newstate) => {
      if (graph.getVertex(oldstate)) {
        d3.select(graph.getVertex(oldstate).domNode).classed('current-state', false);
      }
      if (graph.getVertex(newstate)) {
        d3.select(graph.getVertex(newstate).domNode).classed('current-state', true);
      }
      return newstate;
    });

    this.isHalted = false;
    let isRunning = false;
    Object.defineProperty(this, 'isRunning', {
      configurable: true,
      get() { return isRunning; },
      set(value) {
        if (isRunning !== value) {
          isRunning = value;
          if (isRunning) this.step();
        }
      },
    });
  }

  step() {
    if (!this.machine.step()) {
      this.isRunning = false;
      this.isHalted = true;
    }
  }

  reset() {
    this.isRunning = false;
    this.isHalted = false;
    this.machine.state = this.__spec.startState;

    if (this.machine.tapes) { 
      this.machine.tapes.forEach(tape => tape.domNode.remove());
      this.machine.tapes = [
        addTape(this.__parentDiv, this.__spec),
        addBlankTape(this.__parentDiv, { blank: this.__spec.blank }),
        addBlankTape(this.__parentDiv, { blank: this.__spec.blank }),
      ];
    } else {
      this.machine.tape.domNode.remove();
      this.machine.tape = addTape(this.__parentDiv, this.__spec);
    }
  }

  get positionTable() {
    return this.stateviz.positionTable;
  }
  set positionTable(posTable) {
    this.stateviz.positionTable = posTable;
  }
}
