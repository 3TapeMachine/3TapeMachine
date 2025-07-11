import { MoveHead } from './tape/Tape.js';
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
          return ` in the transition from state ${code(state)} and symbol "${code(symbol)}"`;
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
  if(obj.wild != null) {
    obj.wild = String(obj.wild);
    if (obj.wild.length !== 1) {
      throw new TMSpecError('The wild symbol must be a string of length 1', {
        problemValue: obj.wild,
        info: 'The wild symbol is used in 3-tape machines to match any symbol on a tape'
      });
    }
  }
  obj.startState = obj['start state'];
  delete obj['start state'];
  if (obj.startState == null) {
    throw new TMSpecError('No start state was specified', {
      suggestion: 'Assign one using <code>start state: </code>'
    });
  }
  obj.startState = String(obj.startState);

  // Patch type
  if(!obj.type) {
    obj.type = '1tape'; // default type
  }
  if(obj.type !== '1tape' && obj.type !== '3tape') {
    throw new TMSpecError('Invalid machine type', {
      suggestion: 'Specify <code>type: 1tape</code> or <code>type: 3tape</code>'
    });
  }
  checkTableType(obj.table);  
  const synonyms = parseSynonyms(obj.synonyms, obj.table, obj.type);
  obj.table = obj.type==='1tape' ? parseTable1Tape(synonyms, obj.table) : parseTable3Tape(synonyms, obj.table);
  if (!(obj.startState in obj.table)) {
    throw new TMSpecError('The start state has to be declared in the transition table');
  }
  console.log('Parsed Turing machine spec:', obj);
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
function parseSynonyms(val, table, type) {
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
      result[key] = type==='1tape'? parseInstruction1Tape(null, table, actionVal) : parseInstruction3Tape(null, table, actionVal);
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
function parseTable1Tape(synonyms, val) {
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
        stateResult[symbol] = parseInstruction1Tape(synonyms, val, actionVal);
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

// (?SynonymMap, {[key: string]: string}) -> TransitionTable
function parseTable3Tape(synonyms, val) {
  const result = {};
  for (const [state, stateObj] of Object.entries(val)) {
    if (stateObj == null) {
      result[state] = null;
      continue;
    }
    if (typeof stateObj !== 'object') {
      throw new TMSpecError('State entry has an invalid type', {
        problemValue: typeof stateObj, state,
        info: 'Each state should map 3-symbol patterns to instructions. An empty map signifies a halting state.'
      });
    }
    const patternList = [];
    for (const [pattern, actionVal] of Object.entries(stateObj)) {
      if (typeof pattern !== 'string' || pattern.length !== 3) {
        throw new TMSpecError('Invalid 3-tape pattern', {
          problemValue: pattern,
          info: 'Each key must be a 3-character string (symbols for each tape, wildcards allowed)'
        });
      }
      try {
        patternList.push({
          pattern,
          instruction: parseInstruction3Tape(synonyms, val, actionVal)
        });
      } catch (e) {
        if (e instanceof TMSpecError) {
          e.details.state = state;
          e.details.symbol = pattern;
        }
        throw e;
      }
    }
    result[state] = patternList;
  }
  return result;
}

// omits null/undefined properties
function makeInstruction1Tape(symbol, move, state) {
  const answer = { symbol, move, state };
  if (symbol == null) delete answer.symbol;
  if (state == null) delete answer.state;
  return Object.freeze(answer);
}
function makeInstruction3Tape(write1, write2, write3, move1, move2, move3, state) {
  const answer = { write1, write2, write3, move1, move2, move3, state};
  for(const key in answer) {
    if(answer[key] == null) delete answer[key];
  }
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
function parseInstruction1Tape(synonyms, table, val) {
  return checkTarget(table, (() => {
    switch (typeof val) {
      case 'string': return parseInstructionString1Tape(synonyms, val);
      case 'object': return parseInstructionObject1Tape(val);
      default: throw new TMSpecError('Invalid instruction type', {
        problemValue: typeof val,
        info: 'An instruction can be a string (a direction <code>L</code>/<code>R</code> or a synonym)'
          + ' or a mapping (examples: <code>{R: accept}</code>, <code>{write: \' \', L: start}</code>)'
      });
    }
  })());
}

// (SynonymMap?, Object, string | Object) -> TMAction
function parseInstruction3Tape(synonyms, table, val) {
  return checkTarget(table, (() => {
    switch (typeof val) {
      case 'string': return parseInstructionString3Tape(synonyms, val);
      case 'object': return parseInstructionObject3Tape(val);
      default: throw new TMSpecError('Invalid instruction type', {
        problemValue: typeof val,
        info: 'An instruction can be 3 moves (such as <code>RLS</code> or a synonym)'
          + ' or a mapping (example: <code>{write: \'1 0\', move : "RLS, next: accept}</code>, <code>{write: \'   \', next: start}</code>)'
      });
    }
  })());}

const allowed = { L: MoveHead.left, R: MoveHead.right, S: MoveHead.stay };
  
// case: direction or synonym
function parseInstructionString1Tape(synonyms, val) {
  if (val in allowed)
    return  Object.freeze({ move:allowed[val] });
  if (synonyms && synonyms[val]) { return synonyms[val]; }
  // Else treat as next state
  return Object.freeze({ state: val, move: MoveHead.stay });
}

// case: direction or synonym
function parseInstructionString3Tape(synonyms, val) {
  if (synonyms && synonyms[val]) return synonyms[val];
  if (val.length === 3) // possible move string {
    try {
      const moves = ['move1', 'move2', 'move3'];
      const obj = {};
      for (let i = 0; i < 3; ++i) {
        const c = val[i];
        if (!(c in allowed)) {
          throw new TMSpecError(`Invalid ${['first','second','third'][i]} tape move`, {
            problemValue: c,
            info: `The ${['first','second','third'][i]} character of a 3-tape instruction string must be <code>L</code>, <code>R</code>, or <code>S</code>`
          });
        }
        obj[moves[i]] = allowed[c];
      }
      return Object.freeze(obj);
    } catch  {
      // do nothing - not a move string
    }
 
  // Otherwise, treat as "goto state"
  return Object.freeze({ state: val });
}


// type ActionObj = {write?: any, L: ?string} | {write?: any, R: ?string}
function parseInstructionObject1Tape(val) {
  if (val == null) throw new TMSpecError('Missing instruction');

  // Allowed keys and movement keys
  const allowedKeys = new Set(['L', 'R', 'S', 'write']);
  const moveKeys = ['L', 'R', 'S'];

  // Check for unrecognized keys
  for (const key of Object.keys(val)) {
    if (!allowedKeys.has(key)) {
      throw new TMSpecError('Unrecognized key', {
        problemValue: key,
        info: 'An instruction always has a tape movement <code>L</code>, <code>R</code>, or <code>S</code> (stay), and optionally can <code>write</code> a symbol'
      });
    }
  }

  // Find which movement key is present
  const presentMoves = moveKeys.filter(k => k in val);
  if (presentMoves.length !== 1) {
    throw new TMSpecError(
      presentMoves.length === 0 ? 'Missing movement direction' : 'Conflicting tape movements',
      { info: 'Each instruction needs exactly one movement direction (L, R, or S)' }
    );
  }

  // Map movement key to MoveHead and state
  const moveMap = { L: MoveHead.left, R: MoveHead.right, S: MoveHead.stay };
  const moveKey = presentMoves[0];
  const move = moveMap[moveKey];
  const state = val[moveKey];

  // Validate and extract write symbol if present
  let symbol;
  if ('write' in val) {
    const writeStr = String(val.write);
    if (writeStr.length !== 1) {
      throw new TMSpecError('Write requires a string of length 1');
    }
    symbol = writeStr;
  }

  return makeInstruction1Tape(symbol, move, state);
}

// type ActionObj = {write?: any, L: ?string} | {write?: any, R: ?string}
function parseInstructionObject3Tape(val) {
  if (val == null) throw new TMSpecError('Missing instruction');

  // Allowed keys
  const allowedKeys = new Set(['write', 'move', 'next']);
  for (const key of Object.keys(val)) {
    if (!allowedKeys.has(key)) {
      throw new TMSpecError('Unrecognized key', {
        problemValue: key,
        info: 'A 3-tape instruction can have <code>write</code>, <code>move</code>, and <code>next</code> (the next state).'
      });
    }
  }

  // Parse write fields
  let write1, write2, write3;
  if ('write' in val) {
    const w = String(val.write);
    if (w.length !== 3) {
      throw new TMSpecError('3-tape write requires a string of length 3', {
        problemValue: w,
        info: "Use <code>write: \"a b\"</code> to write 'a' to tape1, a blank to tape2, and 'b' to tape3"
      });
    }
    [write1, write2, write3] = w.split('');
  } 

  // Parse move fields
  const allowedMoves = { L: MoveHead.left, R: MoveHead.right, S: MoveHead.stay };
  let move1, move2, move3;
  if ('move' in val) {
    const m = String(val.move);
    if (m.length !== 3) {
      throw new TMSpecError('3-tape move requires a string of length 3', {
        problemValue: m,
        info: 'Use <code>move: "RLS"</code> to move tape1 right, tape2 left, and not move tape3 (stay).'
      });
    }
    [move1, move2, move3] = m.split('').map((c, i) => {
      if (!(c in allowedMoves)) {
        throw new TMSpecError(`Invalid move${i+1} for tape ${i+1}`, {
          problemValue: c,
          info: 'Each move must be <code>L</code>, <code>R</code>, or <code>S</code>'
        });
      }
      return allowedMoves[c];
    });
  }

  return makeInstruction3Tape(write1, write2, write3, move1, move2, move3, val.next);
}
export const YAMLException = jsyaml.YAMLException;
