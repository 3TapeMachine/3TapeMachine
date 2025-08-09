import { parseSpec } from './parser.js';
import TMViz from './TMViz.js';
import { watchInit } from './watch.js';

/**
 * Turing machine simulator component.
 *
 * Contains a state diagram, tape diagram, and button controls.
 * @param {HTMLElement} container
 * @param {Object} buttons
 */
export default class TMSimulator {
  constructor(container, buttons) {
    this.container = container;
    this.buttons = buttons;

    this.buttons.step.addEventListener('click', () => {
      if (this.machine) {
        this.machine.isRunning = false;
        this.machine.step();
      }
    });
    this.buttons.run.addEventListener('click', () => {
      if (this.machine) {
        this.machine.isRunning = !this.machine.isRunning;
      }
    });
    this.buttons.reset.addEventListener('click', () => {
      if (this.machine) {
        this.machine.reset();
      }
    });

    // Collect all button elements into an array for easy disabling/enabling
    this.buttons.all = Object.values(this.buttons).filter(
      b => b instanceof HTMLElement || (b && typeof b.disabled !== 'undefined')
    );

    // The innerHTML for the "Run" button.
    this.htmlForRunButton =
    '<i class="bi bi-play-fill"></i><br>Run';
    this.htmlForPauseButton =
    '<i class="bi bi-pause-fill"></i><br>Pause';

    this.clear();
  }

  clear() {
    this.sourceCode = null;
  }

  get sourceCode() {
    return this.__sourceCode;
  }

  set sourceCode(sourceCode) {
    if (this.machine) {
      this.machine.isRunning = false;
      this.machine.stateviz.force.stop();
    }
    if (sourceCode == null) {
      this.machine = null;
      this.container.innerHTML = '';
    } else {
      const spec = parseSpec(sourceCode);
      if (this.machine) {
        // update: copy & restore positions, clear & load contents
        const posTable = this.machine.positionTable;
        this.clear();
        this.machine = new TMViz(this.container, spec, posTable);
      } else {
        // load new
        this.machine = new TMViz(this.container, spec, spec.positions);//passing the YAML positions when changes are made to YAML file
      }
    }
    this.__sourceCode = sourceCode;
  }

  get positionTable() {
    return this.machine && this.machine.positionTable;
  }

  set positionTable(posTable) {
    if (this.machine && posTable) {
      this.machine.positionTable = posTable;
    }
  }

  get machine() {
    return this.__machine;
  }

  set machine(machine) {
    this.__machine = machine;
    this.rebindButtons();
  }

  // bind: .disabled for Step and Run, and .innerHTML (Run/Pause) for Run
  rebindButtons() {
    const buttons = this.buttons;
    const enable = this.machine != null;
    if (enable) {
      rebindStepRun(
        buttons.step,
        buttons.run,
        this.htmlForRunButton,
        this.htmlForPauseButton,
        this.machine
      );
    }
    buttons.all.forEach(b => {
      b.disabled = !enable;
    });
  }
}

// Helper for binding step/run/pause button state
function rebindStepRun(stepButton, runButton, runHTML, pauseHTML, machine) {
  function onHaltedChange(isHalted) {
    stepButton.disabled = isHalted;
    runButton.disabled = isHalted;
  }
  function onRunningChange(isRunning) {
    runButton.innerHTML = isRunning ? pauseHTML : runHTML;
  }
  watchInit(machine, 'isHalted', function (prop, oldval, isHalted) {
    onHaltedChange(isHalted);
    return isHalted;
  });
  watchInit(machine, 'isRunning', function (prop, oldval, isRunning) {
    onRunningChange(isRunning);
    return isRunning;
  });
}
