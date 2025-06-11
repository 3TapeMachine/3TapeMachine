import { parseDocument } from './sharing/format.js';

import repeat01 from './examples/repeat01.yaml';
import binaryIncrement from './examples/binaryIncrement.yaml';
import divisibleBy3 from './examples/divisibleBy3.yaml';
import copy1s from './examples/copy1s.yaml';
import divisibleBy3Base10 from './examples/divisibleBy3Base10.yaml';
import matchThreeLengths from './examples/matchThreeLengths.yaml';
import matchBinaryStrings from './examples/matchBinaryStrings.yaml';
import palindrome from './examples/palindrome.yaml';
import busyBeaver3 from './examples/busyBeaver3.yaml';
import busyBeaver4 from './examples/busyBeaver4.yaml';
import powersOfTwo from './examples/powersOfTwo.yaml';
import lengthMult from './examples/lengthMult.yaml';
import binaryAdd from './examples/binaryAdd.yaml';
import unaryMult from './examples/unaryMult.yaml';
import binaryMult from './examples/binaryMult.yaml';
import adder3Tape from './examples/adder3Tape.yaml';
import _template1Tape from './examples/_template1Tape.yaml';

const exampleMap = {
  repeat01,
  binaryIncrement,
  divisibleBy3,
  copy1s,
  divisibleBy3Base10,
  matchThreeLengths,
  matchBinaryStrings,
  palindrome,
  busyBeaver3,
  busyBeaver4,
  powersOfTwo,
  lengthMult,
  binaryAdd,
  unaryMult,
  binaryMult,
  adder3Tape
};

const examplePairs = Object.entries(exampleMap).map(([id, yaml]) => {
  const doc = parseDocument(yaml);
  doc.id = id;
  return [id, doc];
});

const examples = Object.freeze(Object.fromEntries(examplePairs));

function hasID(docID) {
  return Object.prototype.hasOwnProperty.call(examples, docID);
}

export function get(docID) {
  return hasID(docID) ? examples[docID] : null;
}

export const list= examplePairs.map(([, doc]) => doc);
export const firsttimeDocID = 'adder3Tape';//'binaryIncrement';
export const blankTemplate = parseDocument(_template1Tape);

export default { list, firsttimeDocID, blankTemplate };
