// Made from src/board.js by src/share.js (npm run build): the lens's own rules, for the view. Change them there, not here.
var WordTilesRules = (function () {
  'use strict';
  /** The board is 11 × 11: columns A to K, rows 1 to 11. The first word goes through its middle. */
  const SIZE = 11;
  const COLUMNS = 'ABCDEFGHIJK';
  const MIDDLE = 'F6';
  /** Seven tiles lie on the rack. Laying all seven at once counts this much on top. */
  const RACK = 7;
  const ALL_SEVEN = 30;
  /** The bag: every letter, how many tiles of it there are and what one counts. */
  const LETTERS = {
    A: [6, 1], B: [1, 5], C: [2, 4], D: [2, 3], E: [7, 1], F: [1, 5], G: [2, 4], H: [2, 3], I: [4, 1], J: [1, 9], K: [1, 6], L: [3, 2], M: [2, 4],
    N: [4, 2], O: [5, 1], P: [2, 4], Q: [1, 12], R: [4, 2], S: [3, 2], T: [4, 2], U: [2, 2], V: [1, 6], W: [1, 5], X: [1, 7], Y: [1, 5], Z: [1, 11],
  };

  /**
   * What a square is worth to a tile laid on it: 'dl' (the letter counts double), 'tl' (the letter counts three
   * times), 'dw' (the word counts double), or '' (nothing). The layout is the same from all four sides: eight
   * double-word squares a knight's move from the edges' middles, triple letters in the corners and around the middle,
   * double letters between them.
   */
  function bonus(x, y) {
    const a = Math.abs(x - 5), b = Math.abs(y - 5);
    const key = Math.min(a, b) * 10 + Math.max(a, b);
    if (key === 14) return 'dw';
    if (key === 55 || key === 22) return 'tl';
    if (key === 25 || key === 3 || key === 11) return 'dl';
    return '';
  }

  /** A square's name ("F6": column F, row 6) and back ({x, y}, both from 0; null if there is no such square). */
  const square = (x, y) => COLUMNS[x] + (y + 1);
  function where(at) {
    const m = /^\s*([A-Ka-k])\s*(\d{1,2})\s*$/.exec(typeof at === 'string' ? at : '');
    if (!m) return null;
    const y = +m[2] - 1;
    return y >= 0 && y < SIZE ? { x: COLUMNS.indexOf(m[1].toUpperCase()), y } : null;
  }
  /** The letter on a square of the board (`rows`: eleven lines of eleven, '.' where nothing lies), or ''. */
  const letterAt = (rows, x, y) => (x < 0 || y < 0 || x >= SIZE || y >= SIZE || rows[y][x] === '.' ? '' : rows[y][x]);
  const an = (letter) => ('AEFHILMNORSX'.includes(letter) ? 'an ' : 'a ') + letter;

  /** What a word counts: its letters' values, a bonus square only under a tile laid now (`fresh`). */
  function count(cells) {
    let sum = 0, times = 1;
    for (const cell of cells) {
      const kind = cell.fresh ? bonus(cell.x, cell.y) : '';
      sum += LETTERS[cell.letter][1] * (kind === 'dl' ? 2 : kind === 'tl' ? 3 : 1);
      if (kind === 'dw') times *= 2;
    }
    return sum * times;
  }

  /**
   * The referee. A move is a whole word, where it starts and which way it runs: {word: 'GARDEN', at: 'D6', dir:
   * 'across'}. Which of its letters lie on the board already and which come from the rack follows from the board.
   * Legal: {word, at, dir, tiles: [{at, letter}] (the ones laid now), words: [{word, points}] (the word itself first,
   * then every word a laid tile makes or extends across it), points, all (all seven laid)}. Not legal: {error}.
   */
  function judge(rows, rack, play) {
    const word = typeof play.word === 'string' ? play.word.trim().toUpperCase() : '';
    const start = where(play.at);
    const dir = typeof play.dir === 'string' ? play.dir.trim().toLowerCase() : '';
    if (!/^[A-Z]+$/.test(word)) return { error: 'a word is written in the letters A to Z' };
    if (word.length < 2) return { error: 'a word has at least two letters' };
    if (!start) return { error: 'where the word starts is a square like F6: a column A to K, a row 1 to 11' };
    if (dir !== 'across' && dir !== 'down') return { error: 'which way the word runs is "across" or "down"' };
    const dx = dir === 'across' ? 1 : 0, dy = 1 - dx;
    const at = square(start.x, start.y);
    const endX = start.x + dx * (word.length - 1), endY = start.y + dy * (word.length - 1);
    if (endX >= SIZE || endY >= SIZE) return { error: `${word} does not fit on the board from ${at} ${dir}` };
    if (letterAt(rows, start.x - dx, start.y - dy)) return { error: `a tile lies right before ${at}: say the whole word` };
    if (letterAt(rows, endX + dx, endY + dy)) return { error: `a tile lies right after ${square(endX, endY)}: say the whole word` };

    const left = rack.slice();
    const cells = [];
    let touches = false;
    for (let i = 0; i < word.length; i++) {
      const x = start.x + dx * i, y = start.y + dy * i;
      const there = letterAt(rows, x, y);
      if (there) {
        if (there !== word[i]) return { error: `on ${square(x, y)} lies ${an(there)}, not ${an(word[i])}` };
        touches = true;
        cells.push({ x, y, letter: there, fresh: false });
        continue;
      }
      const mine = left.indexOf(word[i]);
      if (mine < 0) return { error: rack.includes(word[i]) ? `the rack has not that many ${word[i]}` : `there is no ${word[i]} on the rack` };
      left.splice(mine, 1);
      cells.push({ x, y, letter: word[i], fresh: true });
      if (letterAt(rows, x - dy, y - dx) || letterAt(rows, x + dy, y + dx)) touches = true;
    }
    const laid = cells.filter((cell) => cell.fresh);
    if (!laid.length) return { error: `${word} lies there already` };
    if (rows.every((row) => !/[A-Z]/.test(row))) {
      const middle = where(MIDDLE);
      if (!cells.some((cell) => cell.x === middle.x && cell.y === middle.y)) return { error: `the first word goes through the middle square, ${MIDDLE}` };
    } else if (!touches) return { error: 'a word must touch one that lies on the board' };

    const words = [{ word, points: count(cells) }];
    for (const tile of laid) {
      // Across the word: what this tile joins there, if anything.
      const cross = [tile];
      for (let x = tile.x - dy, y = tile.y - dx; letterAt(rows, x, y); x -= dy, y -= dx) cross.unshift({ x, y, letter: letterAt(rows, x, y), fresh: false });
      for (let x = tile.x + dy, y = tile.y + dx; letterAt(rows, x, y); x += dy, y += dx) cross.push({ x, y, letter: letterAt(rows, x, y), fresh: false });
      if (cross.length > 1) words.push({ word: cross.map((cell) => cell.letter).join(''), points: count(cross) });
    }
    const all = laid.length === RACK;
    return { word, at, dir, tiles: laid.map((cell) => ({ at: square(cell.x, cell.y), letter: cell.letter })), words, points: words.reduce((sum, w) => sum + w.points, 0) + (all ? ALL_SEVEN : 0), all };
  }

  /**
   * Tiles lying on the board tentatively ([{at, letter}]), read as a move for the referee: {word, at, dir}, the whole
   * word they make with what lies there. Or {error}: not in one line, with a gap, or one tile on its own.
   */
  function lay(rows, placed) {
    const spots = [];
    for (const tile of placed) {
      const spot = where(tile.at);
      if (!spot || letterAt(rows, spot.x, spot.y)) return { error: 'a tile goes on a free square' };
      spots.push({ x: spot.x, y: spot.y, letter: tile.letter });
    }
    if (!spots.length) return { error: 'lay at least one tile' };
    const row = spots.every((spot) => spot.y === spots[0].y), column = spots.every((spot) => spot.x === spots[0].x);
    if (!row && !column) return { error: 'tiles go in one row or one column' };
    const letter = (x, y) => (spots.find((spot) => spot.x === x && spot.y === y) || {}).letter || letterAt(rows, x, y);
    // One tile: it reads across if something lies beside it, else down.
    const first = spots[0];
    const across = spots.length > 1 ? row : Boolean(letterAt(rows, first.x - 1, first.y) || letterAt(rows, first.x + 1, first.y)) || !(letterAt(rows, first.x, first.y - 1) || letterAt(rows, first.x, first.y + 1));
    const dx = across ? 1 : 0, dy = 1 - dx;
    let x = Math.min(...spots.map((spot) => spot.x)), y = Math.min(...spots.map((spot) => spot.y));
    while (letter(x - dx, y - dy)) (x -= dx), (y -= dy);
    let word = '';
    let endX = x, endY = y;
    for (; letter(endX, endY); endX += dx, endY += dy) word += letter(endX, endY);
    if (spots.some((spot) => (dx ? spot.x >= endX : spot.y >= endY))) return { error: 'no gaps: the tiles make one word' };
    if (word.length < 2) return { error: rows.every((line) => !/[A-Z]/.test(line)) ? 'a word has at least two letters' : 'a word must touch one that lies on the board' };
    return { word, at: square(x, y), dir: across ? 'across' : 'down' };
  }
  return { SIZE, COLUMNS, MIDDLE, RACK, ALL_SEVEN, LETTERS, bonus, square, where, judge, lay };
})();
