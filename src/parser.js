import * as TM from './TuringMachine1Tape.js';
import jsyaml from 'js-yaml';

/**
 * Thrown when parsing a string that is valid as YAML but invalid
 * as a machine specification.
 */
export class TMSpecError extends Error {
  constructor(reason, details = {}) {
    super();
    this.name = 'TMSpecError';
    this.reason = reason;
    this.details = details;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, TMSpecError);
    }
  }

  get message() {
    const code = str => `<code>${str}</code>`;
    const showLoc = (state, symbol, synonym) => {
      if (state != null) {
        if (symbol != null) {
          return ` in the transition from state ${code(state)} and symbol ${code(symbol)}`;
        } else {
          return ` for state ${code(state)}`;
        }
      } else if (synonym != null) {
        return ` in the definition of synonym ${code(synonym)}`;
      }
      return '';
    };
    const details = this.details;
    const problemValue = details.problemValue ? ' ' + code(details.problemValue) : '';
    const problemLocation = showLoc(details.state, details.symbol, details.synonym);
    const sentences = [
      `<strong>${this.reason}${problemValue}</strong>${problemLocation}`,
      details.info,
      details.suggestion
    ]
      .filter(Boolean)
      .map(s => s + '.');
    if (problemLocation) { sentences.splice(1, 0, '<br>'); }
    return sentences.join(' ');
  }
}

// throws YAMLException on YAML syntax error
// throws TMSpecError for an invalid spec (eg. no start state, transitioning to an undefined state)
// string -> TMSpec
export function parseSpec(str) {
  const obj = jsyaml.load(str);
  if (obj == null) {
    throw new TMSpecError('The document is empty', {
      info: 'Every Turing machine requires a <code>blank</code> tape symbol,' +
        ' a <code>start state</code>, and a transition <code>table</code>'
    });
  }
  const detailsForBlank = {
    suggestion: 'Examples: <code>blank: \' \'</code>, <code>blank: \'0\'</code>'
  };
  if (obj.blank == null) {
    throw new TMSpecError('No blank symbol was specified', detailsForBlank);
  }
  obj.blank = String(obj.blank);
  if (obj.blank.length !== 1) {
    throw new TMSpecError('The blank symbol must be a string of length 1', detailsForBlank);
  }
  obj.startState = obj['start state'];
  delete obj['start state'];
  if (obj.startState == null) {
    throw new TMSpecError('No start state was specified', {
      suggestion: 'Assign one using <code>start state: </code>'
    });
  }
  obj.startState = String(obj.startState);
  checkTableType(obj.table);
  const synonyms = parseSynonyms(obj.synonyms, obj.table);
  obj.table = parseTable(synonyms, obj.table);
  if (!(obj.startState in obj.table)) {
    throw new TMSpecError('The start state has to be declared in the transition table');
  }
  return obj;
}

function checkTableType(val) {
  if (val == null) {
    throw new TMSpecError('Missing transition table', {
      suggestion: 'Specify one using <code>table:</code>'
    });
  }
  if (typeof val !== 'object') {
    throw new TMSpecError('Transition table has an invalid type', {
      problemValue: typeof val,
      info: 'The transition table should be a nested mapping from states to symbols to instructions'
    });
  }
}

// (any, Object) -> ?SynonymMap
function parseSynonyms(val, table) {
  if (val == null) {
    return null;
  }
  if (typeof val !== 'object') {
    throw new TMSpecError('Synonyms table has an invalid type', {
      problemValue: typeof val,
      info: 'Synonyms should be a mapping from string abbreviations to instructions'
        + ' (e.g. <code>accept: {R: accept}</code>)'
    });
  }
  // Native mapValues
  const result = {};
  for (const [key, actionVal] of Object.entries(val)) {
    try {
      result[key] = parseInstruction(null, table, actionVal);
    } catch (e) {
      if (e instanceof TMSpecError) {
        e.details.synonym = key;
        if (e.reason === 'Unrecognized string') {
          e.details.info = 'Note that a synonym cannot be defined using another synonym';
        }
      }
      throw e;
    }
  }
  return result;
}

// (?SynonymMap, {[key: string]: string}) -> TransitionTable
function parseTable(synonyms, val) {
  const result = {};
  for (const [state, stateObj] of Object.entries(val)) {
    if (stateObj == null) {
      result[state] = null;
      continue;
    }
    if (typeof stateObj !== 'object') {
      throw new TMSpecError('State entry has an invalid type', {
        problemValue: typeof stateObj, state,
        info: 'Each state should map symbols to instructions. An empty map signifies a halting state.'
      });
    }
    const stateResult = {};
    for (const [symbol, actionVal] of Object.entries(stateObj)) {
      try {
        stateResult[symbol] = parseInstruction(synonyms, val, actionVal);
      } catch (e) {
        if (e instanceof TMSpecError) {
          e.details.state = state;
          e.details.symbol = symbol;
        }
        throw e;
      }
    }
    result[state] = stateResult;
  }
  return result;
}

// omits null/undefined properties
function makeInstruction(symbol, move, state) {
  const answer = { symbol, move, state };
  if (symbol == null) delete answer.symbol;
  if (state == null) delete answer.state;
  return Object.freeze(answer);
}

function checkTarget(table, instruct) {
  if (instruct.state != null && !(instruct.state in table)) {
    throw new TMSpecError('Undeclared state', {
      problemValue: instruct.state,
      suggestion: 'Make sure to list all states in the transition table and define their transitions (if any)'
    });
  }
  return instruct;
}

// (SynonymMap?, Object, string | Object) -> TMAction
function parseInstruction(synonyms, table, val) {
  return checkTarget(table, (() => {
    switch (typeof val) {
      case 'string': return parseInstructionString(synonyms, val);
      case 'object': return parseInstructionObject(val);
      default: throw new TMSpecError('Invalid instruction type', {
        problemValue: typeof val,
        info: 'An instruction can be a string (a direction <code>L</code>/<code>R</code> or a synonym)'
          + ' or a mapping (examples: <code>{R: accept}</code>, <code>{write: \' \', L: start}</code>)'
      });
    }
  })());
}

const moveLeft = Object.freeze({ move: TM.MoveHead.left });
const moveRight = Object.freeze({ move: TM.MoveHead.right });
const moveStay = Object.freeze({ move: TM.MoveHead.stay });

// case: direction or synonym
function parseInstructionString(synonyms, val) {
  if (val === 'L') {
    return moveLeft;
  } else if (val === 'R') {
    return moveRight;
  }
  else if (val === 'S') {
    return moveStay;
  }
  if (synonyms && synonyms[val]) { return synonyms[val]; }
  throw new TMSpecError('Unrecognized string', {
    problemValue: val,
    info: 'An instruction can be a string if it\'s a synonym or a direction'
  });
}

// type ActionObj = {write?: any, L: ?string} | {write?: any, R: ?string}
function parseInstructionObject(val) {
  let symbol, move, state;
  if (val == null) { throw new TMSpecError('Missing instruction'); }
  // prevent typos: check for unrecognized keys
  const allowedKeys = new Set(['L', 'R', 'S', 'write']);
  for (const key of Object.keys(val)) {
    if (!allowedKeys.has(key)) {
      throw new TMSpecError('Unrecognized key', {
        problemValue: key,
        info: 'An instruction always has a tape movement <code>L</code>, <code>R</code>, or <code>S</code> (stay), '
          + 'and optionally can <code>write</code> a symbol'
      });
    }
  }
  // one L/R key is required, with optional state value
  if ( ('L' in val && ('S' in val || 'R' in val)) || ('S' in val && ('R' in val))) {
    throw new TMSpecError('Conflicting tape movements', {
      info: 'Each instruction needs exactly one movement direction, but more were found'
    });
  }
  if ('L' in val) {
    move = TM.MoveHead.left;
    state = val.L;
  } else if ('R' in val) {
    move = TM.MoveHead.right;
    state = val.R;
  } else if ('S' in val) {
    move = TM.MoveHead.stay;
    state = val.S;  
  } else {
    throw new TMSpecError('Missing movement direction');
  }
  // write key is optional, but must contain a char value if present
  if ('write' in val) {
    const writeStr = String(val.write);
    if (writeStr.length === 1) {
      symbol = writeStr;
    } else {
      throw new TMSpecError('Write requires a string of length 1');
    }
  }
  return makeInstruction(symbol, move, state);
}

export const YAMLException = jsyaml.YAMLException;