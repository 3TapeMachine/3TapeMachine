import {move }  from './tape/Tape.js';

/**
 * TuringMachine class.
 */
export class TuringMachine1Tape {
  /**
   * @param {(state, symbol) => ?{state: state, symbol: symbol, move: direction}} transition
   * @param {*} startState
   * @param {*} tape
   */
  constructor(transition, startState, tape) {
    this.transition = transition;
    this.state = startState;
    this.tape = tape;
  }

  toString() {
    return `${this.state}\n${this.tape}`;
  }

  /**
   * Step to the next configuration according to the transition function.
   * @return {boolean} true if successful (the transition is defined), false otherwise (machine halted)
   */
  step() {
    const instruct = this.nextInstruction;
    if (instruct == null) return false;

    this.tape.write(instruct.symbol);
    move(this.tape, instruct.move);
    this.state = instruct.state;

    return true;
  }

  get nextInstruction() {
    return this.transition(this.state, this.tape.read());
  }

  get isHalted() {
    return this.nextInstruction == null;
  }
}

