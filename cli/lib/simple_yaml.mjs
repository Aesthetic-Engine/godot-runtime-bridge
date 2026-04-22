function stripComment(line) {
  const trimmed = line.trim();
  if (trimmed.startsWith("#")) return "";
  return line;
}

function splitKeyValue(text) {
  const idx = text.indexOf(":");
  if (idx < 0) return null;
  return [text.slice(0, idx).trim(), text.slice(idx + 1).trim()];
}

function parseScalar(value) {
  if (value === "") return "";
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null") return null;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  return value;
}

function parseLines(text) {
  return text
    .split(/\r?\n/)
    .map(stripComment)
    .filter((line) => line.trim().length > 0)
    .map((line) => ({
      indent: line.match(/^ */)[0].length,
      text: line.trim(),
    }));
}

function parseBlock(lines, state, indent) {
  if (state.index >= lines.length) return null;
  return lines[state.index].text.startsWith("- ")
    ? parseArray(lines, state, indent)
    : parseObject(lines, state, indent);
}

function parseObject(lines, state, indent) {
  const obj = {};

  while (state.index < lines.length) {
    const line = lines[state.index];
    if (line.indent < indent || line.text.startsWith("- ")) break;
    if (line.indent > indent) break;

    const pair = splitKeyValue(line.text);
    if (!pair) throw new Error(`Invalid YAML line: ${line.text}`);
    const [key, value] = pair;
    state.index++;

    if (value === "") {
      obj[key] = parseBlock(lines, state, indent + 2);
    } else {
      obj[key] = parseScalar(value);
    }
  }

  return obj;
}

function parseArray(lines, state, indent) {
  const arr = [];

  while (state.index < lines.length) {
    const line = lines[state.index];
    if (line.indent < indent || !line.text.startsWith("- ")) break;
    if (line.indent > indent) break;

    const rest = line.text.slice(2).trim();
    state.index++;

    if (rest === "") {
      arr.push(parseBlock(lines, state, indent + 2));
      continue;
    }

    const pair = splitKeyValue(rest);
    if (!pair) {
      arr.push(parseScalar(rest));
      continue;
    }

    const [key, value] = pair;
    const item = {};
    item[key] = value === "" ? parseBlock(lines, state, indent + 2) : parseScalar(value);

    while (state.index < lines.length) {
      const next = lines[state.index];
      if (next.indent <= indent) break;
      if (next.indent !== indent + 2 || next.text.startsWith("- ")) break;

      const nextPair = splitKeyValue(next.text);
      if (!nextPair) throw new Error(`Invalid YAML line: ${next.text}`);
      const [nextKey, nextValue] = nextPair;
      state.index++;
      item[nextKey] = nextValue === "" ? parseBlock(lines, state, indent + 4) : parseScalar(nextValue);
    }

    arr.push(item);
  }

  return arr;
}

export function parseSimpleYaml(text) {
  const lines = parseLines(text);
  if (lines.length === 0) return {};
  const state = { index: 0 };
  return parseBlock(lines, state, lines[0].indent);
}
