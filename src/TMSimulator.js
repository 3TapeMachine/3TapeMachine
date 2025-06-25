import TMViz from './TMViz.js';
import { formatError } from './sharing/format.js';

/**
 * A wrapper for TMViz that uses a declarative-style interface.
 */
export default class TMSimulator {
  /**
   * @param {Node} container - The DOM element to put the visualization in.
   */
  constructor(container) {
    this.container = container;
    this.viz = null; // The TMViz instance.
    this.error = null;
    this.onError = null;
  }

  get sourceCode() {
    return this.viz ? this.viz.sourceCode : null;
  }
  set sourceCode(str) {
    if (this.viz && this.viz.sourceCode === str) { return; }

    // =================================================================
    // =========== FIX: ADDED A SAFETY CHECK BEFORE .stop() ============
    // =================================================================
    if (this.viz) {
      this.viz.stop();
    }
    
    this.container.style.display = 'none';
    this.error = null;

    if (str != null) {
      try {
        this.viz = new TMViz(this.container, str);
        this.container.style.display = null;
      } catch (e) {
        this.viz = null;
        this.error = formatError(e);
      }
    }
    if (this.onError) { this.onError(this.error); }
  }

  /**
   * Erase the contents of the simulator.
   */
  clear() {
    this.sourceCode = null;
  }

  /**
   * A table of positions of the states in the diagram.
   * @type {LayoutPositions}
   */
  get positionTable() {
    return this.viz ? this.viz.positionTable : null;
  }
  set positionTable(val) {
    if (this.viz) {
      this.viz.positionTable = val;
    }
  }
}