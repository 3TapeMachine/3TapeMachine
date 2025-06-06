'use strict';

let parseDocument = require('./sharing/format').parseDocument;
let fromPairs = require('lodash/fp').fromPairs;   


function requireExample(exName) {
  return require('raw!./examples-3tape/' + exName + '.yaml');
}

/*
var examplePairs = [
  'repeat01',
  'binaryIncrement',
  'divisibleBy3',
  'copy1s',
  'divisibleBy3Base10',
  'matchThreeLengths',
  'matchBinaryStrings',
  'palindrome',
  'busyBeaver3',
  'busyBeaver4',
  'powersOfTwo',
  'lengthMult',
  'binaryAdd',
  'unaryMult',
  'binaryMult'
].map(function (id) {
  // parse each string into a document
  var doc = parseDocument(requireExample(id));
  doc.id = id;

  return [id, doc];
});
*/

let examplePairs = [
  'adder'
].map(function (id) {
  // parse each string into a document
  let doc = parseDocument(requireExample(id));
  doc.id = id;

  return [id, doc];
});

let examples = Object.freeze(fromPairs(examplePairs));

function isExampleID(docID) {
  return {}.hasOwnProperty.call(examples, docID);
}

function get(docID) {
  return isExampleID(docID) ? examples[docID] : null;
}

let list = examplePairs.map(function (pair) { return pair[1]; });


exports.hasID = isExampleID;
exports.get = get;
exports.list = list;
exports.firsttimeDocID = 'adder';
exports.blankTemplate = requireExample('_template');
