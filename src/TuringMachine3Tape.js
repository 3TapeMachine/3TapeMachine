import { move } from './tape/Tape.js';

export class TuringMachine3Tape {
  constructor(transitionFunction, startState, tapes) {
    this.transitionFunction = transitionFunction;
    this.state = startState;
    this.tapes = tapes;
  }

  toString() {
    return `${this.state}\n${this.tapes[0]}\n${this.tapes[1]}\n${this.tapes[2]}`;
  }

  step() {
    const instruct = this.nextInstruction;
    if (instruct == null) return false;

    if (instruct.write) {
      this.tapes[0].write(instruct.write[0]);
      this.tapes[1].write(instruct.write[1]);
      this.tapes[2].write(instruct.write[2]);
    }
    if (instruct.move) {
      move(this.tapes[0], instruct.move[0]);
      move(this.tapes[1], instruct.move[1]);
      move(this.tapes[2], instruct.move[2]);
    }
    if (instruct.state) {
      this.state = instruct.state;
    }

    return true;
  }

  get nextInstruction() {
    const readSymbols = [
      this.tapes[0].read(),
      this.tapes[1].read(),
      this.tapes[2].read(),
    ];
    
    // =================================================================
    // =========== DEBUGGING LOG TO SEE WHAT IS BEING READ =============
    // =================================================================
    const lookupKey = readSymbols.join(',');
    console.log(`Current state: ${this.state}, Symbols read: [${readSymbols}], Lookup key: "${lookupKey}"`);

    return this.transitionFunction(this.state, readSymbols);
  }

  get isHalted() {
    return this.nextInstruction == null;
  }
}