import { TuringMachine1Tape } from './TuringMachine1Tape.js';
import { TuringMachine3Tape } from './TuringMachine3Tape.js';
import TapeViz from './tape/TapeViz.js';
import StateGraph from './state-diagram/StateGraph.js';
import StateViz from './state-diagram/StateViz.js';
import { watchInit } from './watch.js';
import * as d3 from 'd3';

/**
 * Create an animated transition function.
 * @param  {StateGraph} graph
 * @param  {LayoutEdge -> any} animationCallback
 * @return {(string, string) -> Instruction} Created transition function.
 */
function animatedTransition(graph, animationCallback) {
  return function (state, symbol) {
    const tuple = graph.getInstructionAndEdge(state, symbol);
    if (tuple == null) return null;
    animationCallback(tuple.edge);
    return tuple.instruction;
  }
  };


/**
 * Default edge animation callback.
 * @param  {{domNode: Node}} edge
 * @return {D3Transition} The animation. Use this for transition chaining.
 */
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

/**
 * Construct a new state and tape visualization inside a <div>.
 * @constructor
 * @param {HTMLDivElement} div        div to take over and use.
 * @param                  spec       machine specification
 * @param {PositionTable} [posTable]  position table for the state nodes
 */
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

    // We hook into the animation callback to know when to start the next step (when running).
    const animateAndContinue = edge => {
      const transition = this.edgeAnimation(edge);
      if (this.isRunning) {
        transition.transition().duration(this.stepInterval).on('end', () => {
          // stop if machine was paused during the animation
          if (this.isRunning) this.step();
        });
      }
    };
    if(spec.type === '1tape') {
      this.machine = new TuringMachine1Tape(
        animatedTransition(graph, animateAndContinue),
        spec.startState,
        addTape(div, spec)
      );
    }
    else if(spec.type === '3tape') {
      this.machine = new TuringMachine3Tape(
        spec.transition,
        spec.startState,
        addTape(div, spec),
        addBlankTape(div, spec),
        addBlankTape(div, spec)
      );
    }

    // intercept and animate when the state is set
    watchInit(this.machine, 'state', (prop, oldstate, newstate) => {
      d3.select(graph.getVertex(oldstate).domNode).classed('current-state', false);
      d3.select(graph.getVertex(newstate).domNode).classed('current-state', true);
      return newstate;
    });

    // Sidenote: each "Step" click evaluates the transition function once.
    // Therefore, detecting halting always requires its own step (for consistency).
    this.isHalted = false;

    Object.defineProperty(this, 'isRunning', {
      configurable: true,
      get() { return this._isRunning || false; },
      set(value) {
        if ((this._isRunning || false) !== value) {
          this._isRunning = value;
          if (this._isRunning) this.step();
        }
      }
    });
  }

  /**
   * Step the machine immediately and interrupt any animations.
   */
  step() {
    if (!this.machine.step()) {
      this.isRunning = false;
      this.isHalted = true;
    }
  }

  /**
   * Reset the Turing machine to its starting configuration.
   */
  reset() {
    this.isRunning = false;
    this.isHalted = false;
    this.machine.state = this.__spec.startState;
    if (this.__spec.type === '3-tape') {
      // Remove all three tape SVGs and recreate them
      this.machine.tape1.domNode.remove();
      this.machine.tape2.domNode.remove();
      this.machine.tape3.domNode.remove();
      this.machine.tape1 = addTape(this.__parentDiv, this.__spec);
      this.machine.tape2 = addBlankTape(this.__parentDiv, this.__spec);
      this.machine.tape3 = addBlankTape(this.__parentDiv, this.__spec);
    } else {
      // 1-tape case (original logic)
      this.machine.tape.domNode.remove();
      this.machine.tape = addTape(this.__parentDiv, this.__spec);
        }}
      
    }
  
