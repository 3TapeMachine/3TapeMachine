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

    // FIX: Use the instruction format produced by parser.js
    if (instruct.write1) { this.tapes[0].write(instruct.write1); }
    if (instruct.write2) { this.tapes[1].write(instruct.write2); }
    if (instruct.write3) { this.tapes[2].write(instruct.write3); }

    if (instruct.move1) { move(this.tapes[0], instruct.move1); }
    if (instruct.move2) { move(this.tapes[1], instruct.move2); }
    if (instruct.move3) { move(this.tapes[2], instruct.move3); }

    // Update state if needed
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
    return this.transitionFunction(this.state, readSymbols);
  }

  get isHalted() {
    return this.nextInstruction == null;
  }
}
