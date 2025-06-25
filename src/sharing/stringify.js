const INDENT = '  '; // 2 spaces

function isPlainObject(x) {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function needsQuotes(str) {
  // from http://www.yaml.org/spec/1.2/spec.html#id2771112
  // This is not a full list. We quote anything that isn't a plain scalar.
  return /[:{}\[\]#&*!|>'"]/.test(str)
    || /^[ \t\n\r]/.test(str)
    || /[ \t\n\r]$/.test(str)
    || ['true', 'false', 'null'].includes(str.toLowerCase());
}

function quote(str) {
  // This is not a full-featured quoting function.
  // It only handles single-line strings.
  if (needsQuotes(str)) {
    return JSON.stringify(str);
  }
  return str;
}

function stringify(obj, depth = 0) {
  const indent = INDENT.repeat(depth);
  const lines = [];

  for (const [key, value] of Object.entries(obj)) {
    let line = indent + quote(key) + ':';
    if (isPlainObject(value)) {
      const nested = stringify(value, depth + 1);
      if (nested) {
        lines.push(line);
        lines.push(nested);
      }
    } else {
      line += ' ' + String(value);
      lines.push(line);
    }
  }
  return lines.join('\n');
}

export { stringify };