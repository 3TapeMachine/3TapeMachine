import { parseDocument } from './sharing/format.js';

import repeat01 from './examples-1tape/repeat01.yaml';
import binaryIncrement from './examples-1tape/binaryIncrement.yaml';
import divisibleBy3 from './examples-1tape/divisibleBy3.yaml';
import copy1s from './examples-1tape/copy1s.yaml';
import divisibleBy3Base10 from './examples-1tape/divisibleBy3Base10.yaml';
import matchThreeLengths from './examples-1tape/matchThreeLengths.yaml';
import matchBinaryStrings from './examples-1tape/matchBinaryStrings.yaml';
import palindrome from './examples-1tape/palindrome.yaml';
import busyBeaver3 from './examples-1tape/busyBeaver3.yaml';
import busyBeaver4 from './examples-1tape/busyBeaver4.yaml';
import powersOfTwo from './examples-1tape/powersOfTwo.yaml';
import lengthMult from './examples-1tape/lengthMult.yaml';
import binaryAdd from './examples-1tape/binaryAdd.yaml';
import unaryMult from './examples-1tape/unaryMult.yaml';
import binaryMult from './examples-1tape/binaryMult.yaml';
import _template from './examples-1tape/_template.yaml';

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
  binaryMult
};

const examplePairs = Object.entries(exampleMap).map(([id, yaml]) => {
  const doc = parseDocument(yaml);
  doc.id = id;
  return [id, doc];
});

const examples = Object.freeze(Object.fromEntries(examplePairs));

export function hasID(docID) {
  return Object.prototype.hasOwnProperty.call(examples, docID);
}

export function get(docID) {
  return hasID(docID) ? examples[docID] : null;
}

export const list = examplePairs.map(([, doc]) => doc);
export const firsttimeDocID = 'binaryIncrement';
export const blankTemplate = parseDocument(_template);

export default { list, firsttimeDocID, get, hasID, blankTemplate };
