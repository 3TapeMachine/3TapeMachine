import './tape/Tape.js';

/**
 * MoveHead and MoveTape enums for tape movement.
 */

export const MoveHead = Object.freeze({
  left:  { toString: () => 'L' },
  right: { toString: () => 'R' },
  stay:  { toString: () => 'S' }
});
export const MoveTape = Object.freeze({
  left: MoveHead.right,
  right: MoveHead.left,
  stay: MoveHead.stay
});

/**
 * Moves the tape head in the specified direction.
 * @param {Object} tape
 * @param {Object} direction
 */
function move(tape, direction) {
  switch (direction) {
    case MoveHead.right: tape.headRight(); break;
    case MoveHead.left:  tape.headLeft();  break;
    case MoveHead.stay:  tape.headStay();  break;
    default: throw new TypeError('not a valid tape movement: ' + String(direction));
  }
}

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

