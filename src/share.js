// The rules the view needs (the board's layout, the letters, the referee) are the lens's own: this copies the part of
// src/board.js between its <rules> marks into site/rules.js, where the view finds it as WordTilesRules. `npm run
// build` runs it first, so that the view always judges tiles lying tentatively exactly as fold will.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('board.js', import.meta.url)), 'utf8').replace(/\r\n/g, '\n');
const from = source.indexOf('// <rules>');
const to = source.indexOf('// </rules>');
if (from < 0 || to < from) throw new Error('src/board.js has no <rules> … </rules> part');
// Without the lines of the opening mark's own comment.
const rules = source.slice(from, to).replace(/^(\/\/[^\n]*\n)+/, '').trim();
const page = `// Made from src/board.js by src/share.js (npm run build): the lens's own rules, for the view. Change them there, not here.
var WordTilesRules = (function () {
  'use strict';
${rules.replace(/^(?=.)/gm, '  ')}
  return { SIZE, COLUMNS, MIDDLE, RACK, ALL_SEVEN, LETTERS, bonus, square, where, judge, lay };
})();
`;
writeFileSync(fileURLToPath(new URL('../site/rules.js', import.meta.url)), page);
console.log('site/rules.js: the rules as src/board.js has them');
