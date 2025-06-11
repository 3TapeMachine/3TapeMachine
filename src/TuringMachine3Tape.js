import {move }  from './tape/Tape.js';

/**
 * TuringMachine class.
 * 
 * The transition table is a map from a state to an array of possible matches.
 * Each array element is an object with a 3-character 'pattern; and an 'instruction'
 * Each instruction has all or none of move1, move2, and move3 tape operations,
 *     all or none of write1, write2, and write3 one-character symbols to write to the tape,
 *     and an optional next property to change states.
 * 
 */
export class TuringMachine3Tape {
  /**
   * @param {*} transitions
   * @param {*} startState
   * @param {*} tape1
   * @param {*} tape2
   * @param {*} tape3
   * @param String wild 
   */
  constructor(transitions, startState, tape1, tape2, tape3, wild= null) {
    this.transitions = transitions;
    this.state = startState;
    this.tape1 = tape1;
    this.tape2 = tape2;
    this.tape3 = tape3;
    this.wild = wild;
  }

  toString() {
    return `${this.state}\n${this.tape1}\n${this.tape2}\n${this.tape3}`;
  }

  /**
   * Step to the next configuration according to the transition function.
   * @return {boolean} true if successful (the transition is defined), false otherwise (machine halted)
   */
  step() {
    const instruct = this.nextInstruction;
    if (instruct == null) return false;

    if('write1' in instruct)
      this.tape1.write(instruct.write1);
    if('write2' in instruct)
      this.tape2.write(instruct.write2);
    if('write3' in instruct)
      this.tape3.write(instruct.write3);
    if('move1' in instruct)
      move(this.tape1, instruct.move1);
    if('move2' in instruct)
      move(this.tape2, instruct.move2);
    if('move3' in instruct)
      move(this.tape3, instruct.move3);
    if('state' in instruct)
      this.state = instruct.state;

    return true;
  }

  get nextInstruction() {
    for(const transition of this.transitions[this.state] || []) {
      const read1 = transition.pattern[0];
      const read2 = transition.pattern[1];
      const read3 = transition.pattern[2];
      if ((read1 === this.wild || read1 === this.tape1.read()) &&
          (read2 === this.wild || read2 === this.tape2.read()) && 
          (read3 === this.wild || read3 === this.tape3.read())) {
        return transition.instruction;
      }
    }
    // No matching transition found, machine halts
    return null;
  }

  get isHalted() {
    return this.nextInstruction == null;
  }
}

