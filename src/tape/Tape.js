// Bidirectional infinite tape
export class Tape {
  constructor(blank, input) {
    Object.defineProperty(this, 'blank', {
      value: blank,
      writable: false,
      enumerable: true
    });
    // zipper data structure
    // INVARIANTS: tape.before can be empty, tape.after must be nonempty.
    // before: cells before the head (in order; left to right).
    // after:  cells after and including the head (in reverse; right to left).
    this.tape = {
      before: [],
      after: (input == null || input.length === 0) ? [blank] : input.slice().reverse(),
      toString: () => this.before.join('') + '🔎' + this.after.slice().reverse().join('')
    };
  }

  // Read the value at the tape head.
  read() {
    return this.tape.after[this.tape.after.length - 1];
  }

  write(symbol) {
    this.tape.after[this.tape.after.length - 1] = symbol;
  }

  headRight() {
    this.tape.before.push(this.tape.after.pop());
    if (this.tape.after.length == 0) {
      this.tape.after.push(this.blank);
    }
  }

  headLeft() {
    if (this.tape.before.length == 0) {
      this.tape.before.push(this.blank);
    }
    this.tape.after.push(this.tape.before.pop());
  }

  headStay() {
    // do nothing
  }

  toString() {
    return this.tape.toString();
  }

  // for tape visualization. not part of TM definition.
  // Read the value at an offset from the tape head.
  // 0 is the tape head. + is to the right, - to the left.
  readOffset(i) {
    const tape = this.tape;
    if (i >= 0) {
      // right side: offset [0..length-1] ↦ array index [length-1..0]
      return (i <= tape.after.length - 1) ? tape.after[tape.after.length - 1 - i] : this.blank;
    } else {
      // left side: offset [-1..-length] ↦ array index [length-1..0]
      return (i >= -tape.before.length) ? tape.before[tape.before.length + i] : this.blank;
    }
  }

  // for tape visualization.
  // Read the values from an offset range (inclusive of start and end).
  readRange(start, end) {
    const result = [];
    for (let i = start; i <= end; i++) {
      result.push(this.readOffset(i));
    }
    return result;
  }
}

// Tape movement functions
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
export function move(tape, direction) {
  switch (direction) {
    case MoveHead.right: tape.headRight(); break;
    case MoveHead.left:  tape.headLeft();  break;
    case MoveHead.stay:  tape.headStay();  break;
    default: throw new TypeError('not a valid tape movement: ' + String(direction));
  }
}

