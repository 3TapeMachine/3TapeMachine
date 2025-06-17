import { move } from './tape/Tape.js';

/**
 * TuringMachine3Tape class.
 * This class is now driven by a transition *function* provided by TMViz,
 * which allows for state graph animations.
 */
export class TuringMachine3Tape {
  /**
   * @param {Function} transitionFunction A function that takes (state, [s1, s2, s3]) and returns an instruction.
   * @param {string} startState The initial state of the machine.
   * @param {TapeViz[]} tapes An array containing the three tape visualization objects.
   */
  constructor(transitionFunction, startState, tapes) {
    this.transitionFunction = transitionFunction;
    this.state = startState;
    // CHANGE: Store tapes in an array for easier management.
    this.tapes = tapes;
  }

  toString() {
    return `${this.state}\n${this.tapes[0]}\n${this.tapes[1]}\n${this.tapes[2]}`;
  }

  /**
   * Step to the next configuration according to the transition function.
   * @return {boolean} true if successful (the transition is defined), false otherwise (machine halted)
   */
  step() {
    const instruct = this.nextInstruction;
    if (instruct == null) return false;

    // CHANGE: The instruction format from StateGraph uses 'write' and 'move' arrays.
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
    // CHANGE: Read from all three tapes and call the transition function.
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