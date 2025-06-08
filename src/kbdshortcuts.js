import * as d3 from 'd3';

/**
 * Displays a table of keyboard shortcuts.
 */

const identity = x => x;

/**
 * Renders a table, using three layers of list nesting: tbody, tr, td.
 * @param  {[ [[HTML]] ]}     data
 * @param  {HTMLTableElement} table
 * @return {D3Selection}            D3 selection of the <tbody> elements
 */
function renderTable(data, table) {
  const tbody = d3.select(table).selectAll('tbody')
    .data(data)
    .enter().append('tbody');

  const tr = tbody.selectAll('tr')
    .data(identity)
    .enter().append('tr');

  tr.selectAll('td')
    .data(identity)
    .enter().append('td')
    .html(identity);

  return tbody;
}

// Key -> Key
function abbreviateKey(key) {
  switch (key) {
    case 'Command': return 'Cmd';
    case 'Option':  return 'Opt';
    case 'Up':      return '↑';
    case 'Down':    return '↓';
    case 'Left':    return '←';
    case 'Right':   return '→';
    default:        return key;
  }
}

// KeyList -> HTML
function keylistToHTML(keys) {
  return keys.map(key => `<kbd>${key}</kbd>`).join('-');
}

// Commands -> String -> KeyList
function createGetKeylist(commands) {
  const platform = commands.platform;
  // workaround: some ace keybindings for Mac use Alt instead of Option
  const altToOption = platform !== 'mac'
    ? identity
    : key => (key === 'Alt' ? 'Option' : key);

  return function getKeylist(value) {
    return commands.commands[value].bindKey[platform].split('-').map(altToOption);
  };
}

// Fills a <table> with some default keyboard shortcuts.
export function main(commands, table) {
  const getKeylist = createGetKeylist(commands);

  return renderTable(entries.map(group =>
    group.map(d => [
      keylistToHTML(getKeylist(d.name).map(abbreviateKey)),
      d.desc
    ])
  ), table);
}

const entries = [
  [
    { name: 'save', desc: 'Load machine<br> <small>Save changes and load the machine.</small>' }
  ], [
    { name: 'togglecomment', desc: 'Toggle comment' },
    { name: 'indent', desc: 'Indent selection' },
    { name: 'outdent', desc: 'Unindent selection' }
  ], [
    { name: 'movelinesup', desc: 'Move line up' },
    { name: 'movelinesdown', desc: 'Move line down' },
    { name: 'duplicateSelection', desc: 'Duplicate line/selection' }
  ], [
    { name: 'selectMoreAfter', desc: 'Add next occurrence to selection<br> <small>Like a quick “find”. Useful for renaming things.</small>' },
    { name: 'find', desc: 'Find' },
    { name: 'replace', desc: 'Find and Replace' }
  ]
];