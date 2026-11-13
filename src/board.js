// Word Tiles: a word game on a board of posts. A Weave client service in JavaScript, built into a WebAssembly
// component. A project's maintainers pin it to a board; every member's own Weave then shows the board through it. A
// game is a post; its players lay letter tiles from one rack that lies open to all, so that they form words that
// cross the words already there. It's pure: Weave hands it the board's events (fold) and asks what an action means
// (act). It signs nothing: the member does, or their agent for them. fold is the referee: what is not a legal move
// counts for nothing.

// <rules> What follows, up to the closing mark, is also the view's: `npm run build` copies it into site/rules.js, so
// that the view judges tiles lying tentatively exactly as fold will.

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
// </rules>

/** Two to four play a game. */
const PLAYERS = 4;
/** The longest name a game may have, what a seed word looks like, and an agent's name. */
const TITLE = 80;
const SEED = /^[a-z0-9][a-z0-9-]{2,31}$/;
const VIA = /^[a-z0-9][a-z0-9_.-]{0,23}$/;

/** What can be done: Weave reads this, for the view and for agents (weave board act). */
const ACTIONS = [
  { name: 'new', label: 'Start a game', input: { title: `the game's name, at most ${TITLE} characters`, seed: 'a seed word the bag is shuffled from: 3 to 32 lowercase letters, digits or hyphens, like plum-river-17. A new one for every game' } },
  { name: 'join', label: 'Join a game', input: { post: 'the game: its post\'s id (left out: the latest game that is not over)' } },
  {
    name: 'play',
    label: 'Lay a word',
    input: {
      post: 'the game: its post\'s id (left out: the latest game that is not over)',
      word: 'the whole word as it will read on the board, like GARDEN: the letters that lie there already and the ones from the rack',
      at: 'the square of its first letter, like D6: a column A to K, a row 1 to 11',
      dir: 'across | down',
      via: 'for an agent playing for its person: its own name, like claude (left out: by hand)',
    },
  },
  { name: 'pass', label: 'Pass', input: { post: 'the game (left out: the latest that is not over)', via: 'an agent\'s own name (left out: by hand)' } },
  { name: 'swap', label: 'Swap the rack for seven new tiles', input: { post: 'the game (left out: the latest that is not over)', via: 'an agent\'s own name (left out: by hand)' } },
  { name: 'doubt', label: 'Doubt the last word', input: { post: 'the game (left out: the latest that is not over)', via: 'an agent\'s own name (left out: by hand)' } },
];

const line = (value) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '');

/** The seed word a game's post carries: "Bag: plum-river-17" in its text. A post without one is shuffled from its title. */
function seedOf(title, text) {
  const said = /\bbag\s*:\s*([A-Za-z0-9][A-Za-z0-9-]{0,31})/i.exec(typeof text === 'string' ? text : '');
  return (said ? said[1] : title).toLowerCase();
}

/**
 * The bag for a seed word, in the order its tiles will be drawn: the same for everyone who folds the game. A small
 * generator of its own (the seed's letters hashed into a number, then stirred on for every draw) shuffles the tiles
 * from their alphabetical order. Nothing secret about it: whoever reads this can work out what comes next.
 */
function bagFor(seed) {
  let state = 2166136261;
  for (let i = 0; i < seed.length; i++) state = Math.imul(state ^ seed.charCodeAt(i), 16777619);
  const draw = () => {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), state | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return (mixed ^ (mixed >>> 14)) >>> 0;
  };
  const bag = [];
  for (const letter of Object.keys(LETTERS)) for (let i = 0; i < LETTERS[letter][0]; i++) bag.push(letter);
  for (let i = bag.length - 1; i > 0; i--) {
    const j = draw() % (i + 1);
    const tile = bag[i];
    bag[i] = bag[j];
    bag[j] = tile;
  }
  return bag;
}

const blank = () => Array.from({ length: SIZE }, () => '.'.repeat(SIZE));
const put = (rows, at, letter) => {
  const { x, y } = where(at);
  rows[y] = rows[y].slice(0, x) + letter + rows[y].slice(x + 1);
};
/** How many of the other players have to doubt a word for it to be taken back: more than half of them. */
const doubtsNeeded = (players) => Math.floor((players - 1) / 2) + 1;

/** A game as its post begins it: nothing on the board, the first seven tiles on the rack, its maker the first player. */
function begin(item) {
  const title = line(item.body.title) || '(a game)';
  const seed = seedOf(title, item.body.text);
  const bag = bagFor(seed);
  return {
    id: item.id, title, by: item.authorName || item.author, author: item.author, time: item.time, seed,
    players: [{ did: item.author, name: item.authorName || item.author, score: 0 }],
    rows: blank(), laid: [], rack: bag.splice(0, RACK), bag, moves: [], passes: 0, over: false, chats: 0,
    waiting: [], // moves and doubts whose number is ahead of the game: they count once the game gets there
  };
}

/**
 * A tiles.move or a tiles.doubt, taken into the game: 'wait' (its number is ahead of the game), true (it counted)
 * or false (it counts for nothing, now and for good).
 */
function take(game, item) {
  const body = item.body;
  const n = body.n;
  const done = game.moves.length;
  if (typeof n !== 'number' || n % 1 !== 0 || n < 1) return false;
  const seat = game.players.findIndex((player) => player.did === item.author);
  const who = { by: item.author, name: item.authorName || item.author, time: item.time };
  const via = typeof body.via === 'string' && VIA.test(body.via) ? { via: body.via } : {};

  if (item.kind === 'tiles.doubt') {
    // Only the last move can be doubted, and only until the next one is made.
    if (n > done) return 'wait';
    const last = game.moves[done - 1];
    if (n < done || last.move !== 'play' || last.taken || seat < 0 || last.by === item.author || last.doubts.some((doubt) => doubt.by === item.author)) return false;
    last.doubts.push({ ...who, ...via });
    if (last.doubts.length < doubtsNeeded(game.players.length)) return true;
    // Taken back: its tiles return to the rack, what was drawn for them to the top of the bag, its points are gone.
    // The turn has passed on already and stays there. (Not a pass: the row of passes it broke stays broken.)
    last.taken = true;
    for (const tile of last.tiles) put(game.rows, tile.at, '.');
    game.laid = game.laid.filter((tile) => tile.n !== last.n);
    game.rack = last.before.rack;
    game.bag = last.before.bag;
    game.players.find((player) => player.did === last.by).score -= last.points;
    game.over = false; // if it was the last tile: the game goes on
    return true;
  }

  if (n > done + 1) return 'wait';
  if (n <= done || game.over || game.players.length < 2 || seat !== done % game.players.length) return false;
  const move = { n, ...who, ...via };
  if (body.move === 'play') {
    const play = judge(game.rows, game.rack, body);
    if (play.error) return false;
    const before = { rack: game.rack.slice(), bag: game.bag.slice() };
    for (const tile of play.tiles) {
      put(game.rows, tile.at, tile.letter);
      game.laid.push({ at: tile.at, letter: tile.letter, by: item.author, n });
      game.rack.splice(game.rack.indexOf(tile.letter), 1);
    }
    game.rack.push(...game.bag.splice(0, play.tiles.length));
    game.players[seat].score += play.points;
    game.passes = 0;
    // Someone has laid the last tile: the bag is empty and so is the rack.
    game.over = game.rack.length === 0;
    Object.assign(move, { move: 'play', word: play.word, at: play.at, dir: play.dir, tiles: play.tiles, words: play.words, points: play.points, ...(play.all ? { all: true } : {}), doubts: [], before });
  } else if (body.move === 'pass') {
    game.passes += 1;
    // Everyone has passed in turn.
    game.over = game.passes >= game.players.length;
    move.move = 'pass';
  } else if (body.move === 'swap') {
    if (game.bag.length < RACK) return false;
    // Seven new tiles from the top of the bag; the old rack goes to its bottom.
    const old = game.rack;
    game.rack = game.bag.splice(0, RACK);
    game.bag.push(...old);
    game.passes = 0;
    move.move = 'swap';
  } else return false;
  game.moves.push(move);
  return true;
}

/** Take what waits into the game, in its order, for as long as something counts. */
function settle(game) {
  for (let again = true; again; ) {
    again = false;
    for (let i = 0; i < game.waiting.length; i++) {
      const took = take(game, game.waiting[i]);
      if (took === 'wait') continue;
      game.waiting.splice(i, 1);
      i -= 1;
      if (took) {
        again = true; // from the top again: something that waited may count now
        break;
      }
    }
  }
}

/**
 * The games from the board's events, oldest first. A post is a game: its maker is its first player, tiles.join adds
 * up to three more until the first move is made. tiles.move is a turn (play, pass or swap) and carries its number
 * in the game (`n`: 1 for the first); tiles.doubt doubts the move of that number. A move counts if it has the next
 * number, is by whoever's turn it is, and is legal; a doubt counts if it is about the last move, a word still lying
 * there, by another player who has not doubted it yet. Everything else counts for nothing: fold never refuses, it
 * leaves out. A move or doubt whose number is ahead of the game waits until the game gets there (so a clock that
 * runs behind does not cost its owner the turn).
 */
export function fold(board, items) {
  let list = [];
  let about = {};
  try {
    about = JSON.parse(board);
    list = JSON.parse(items);
  } catch {
    // nothing that can be read: an empty board
  }
  if (!Array.isArray(list)) list = [];
  const usable = list
    .filter((item) => item && typeof item === 'object' && typeof item.id === 'string' && typeof item.author === 'string')
    .map((item) => ({ ...item, body: item.body && typeof item.body === 'object' && !Array.isArray(item.body) ? item.body : {} }));
  // The posts first: what is about a game counts wherever its signer's clock put it.
  const games = new Map();
  for (const item of usable) if (item.kind === 'weave.post' || item.kind === 'weave.issue') games.set(item.id, begin(item));
  for (const item of usable) {
    const body = item.body;
    const game = games.get(typeof body.target === 'string' ? body.target : body.post);
    if (!game) continue;
    if (item.kind === 'weave.post.edit' && item.author === game.author) {
      // Its maker may rename it. The bag stays as the post first said it.
      if (line(body.title)) game.title = line(body.title);
    } else if (item.kind === 'weave.post.delete' && item.author === game.author) {
      games.delete(game.id);
    } else if (item.kind === 'weave.msg') {
      game.chats += 1;
    } else if (item.kind === 'tiles.join') {
      if (!game.moves.length && game.players.length < PLAYERS && !game.players.some((player) => player.did === item.author)) game.players.push({ did: item.author, name: item.authorName || item.author, score: 0 });
    } else if (item.kind === 'tiles.move' || item.kind === 'tiles.doubt') {
      game.waiting.push(item);
      settle(game);
    }
  }

  const letters = {};
  for (const letter of Object.keys(LETTERS)) letters[letter] = { tiles: LETTERS[letter][0], value: LETTERS[letter][1] };
  const squares = { dw: [], tl: [], dl: [] };
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (bonus(x, y)) squares[bonus(x, y)].push(square(x, y));
  return JSON.stringify({
    board: about,
    games: [...games.values()].map((game) => {
      const done = game.moves.length;
      const best = Math.max(...game.players.map((player) => player.score));
      const last = game.moves[done - 1];
      return {
        id: game.id, title: game.title, by: game.by, author: game.author, time: game.time, seed: game.seed,
        players: game.players,
        begun: done > 0,
        over: game.over,
        // Whose turn it is, and the number their move will have.
        ...(game.over || game.players.length < 2 ? {} : { turn: game.players[done % game.players.length].did }),
        n: done + 1,
        ...(game.over ? { winners: game.players.filter((player) => player.score === best).map((player) => player.did) } : {}),
        rows: game.rows,
        tiles: game.laid,
        rack: game.rack,
        bag: game.bag.length,
        // The last move, while it is a word that can be doubted: its number, and how many doubts take it back.
        ...(last && last.move === 'play' && !last.taken ? { open: last.n, doubts: doubtsNeeded(game.players.length) } : {}),
        moves: game.moves.map(({ before, ...move }) => move),
        chats: game.chats,
      };
    }),
    rules: { size: SIZE, middle: MIDDLE, rack: RACK, allSeven: ALL_SEVEN, letters, squares },
    actions: ACTIONS,
  });
}

/** What an action proposes, as events for the member to sign; a throw is why not (Weave shows it). */
export function act(name, input, state, me) {
  const asked = JSON.parse(input) ?? {};
  const games = JSON.parse(state)?.games ?? [];
  const my = JSON.parse(me) ?? {};
  if (typeof asked !== 'object') throw 'an action\'s input is an object, like {"post": "…"}';
  if (!ACTIONS.some((action) => action.name === name)) throw `no action "${name}"`;

  if (name === 'new') {
    const title = line(asked.title);
    const seed = typeof asked.seed === 'string' ? asked.seed.trim().toLowerCase() : '';
    if (!title) throw 'a game needs a name ("title")';
    if (title.length > TITLE) throw `a game's name has at most ${TITLE} characters`;
    if (!SEED.test(seed)) throw 'a game needs a seed word ("seed") for its bag: 3 to 32 lowercase letters, digits or hyphens, like plum-river-17';
    return JSON.stringify([{ kind: 'weave.post', body: { title, text: `A game of Word Tiles for two to four: join it on the board. Bag: ${seed}` } }]);
  }

  const none = asked.post === undefined || asked.post === null;
  const open = games.filter((game) => !game.over);
  const game = none ? open[open.length - 1] : games.find((g) => g.id === asked.post);
  if (!game) throw none ? 'no game is going on: start one ("new")' : 'there is no such game on this board';
  const via = asked.via ?? undefined;
  if (via !== undefined && !(typeof via === 'string' && VIA.test(via))) throw '"via" is an agent\'s own name in one lowercase word, like claude';
  const seat = game.players.findIndex((player) => player.did === my.did);

  if (name === 'join') {
    if (seat >= 0) throw 'you are in this game already';
    if (game.begun) throw 'this game has begun: nobody joins it any more';
    if (game.players.length >= PLAYERS) throw `this game has its ${PLAYERS} players`;
    return JSON.stringify([{ kind: 'tiles.join', body: { target: game.id } }]);
  }
  if (seat < 0) throw game.begun ? 'you are not in this game' : 'you are not in this game: join it first';

  if (name === 'doubt') {
    const last = game.moves[game.moves.length - 1];
    if (!last) throw 'no move has been made yet';
    if (last.move !== 'play') throw 'only a word can be doubted';
    if (last.taken) throw `${last.word} has been taken back already`;
    if (last.by === my.did) throw 'that is your own word';
    if (last.doubts.some((doubt) => doubt.by === my.did)) throw `you doubt ${last.word} already`;
    return JSON.stringify([{ kind: 'tiles.doubt', body: { target: game.id, n: last.n, ...(via ? { via } : {}) } }]);
  }

  if (game.over) throw 'this game is over';
  if (game.players.length < 2) throw 'a game needs two players: wait for someone to join';
  if (game.turn !== my.did) throw `it is ${game.players.find((player) => player.did === game.turn).name}'s turn`;
  const move = { target: game.id, n: game.n, move: name };
  if (name === 'play') {
    const play = judge(game.rows, game.rack, asked);
    if (play.error) throw play.error;
    Object.assign(move, { word: play.word, at: play.at, dir: play.dir });
  }
  if (name === 'swap' && game.bag < RACK) throw `the bag holds ${game.bag === 1 ? 'only one tile' : game.bag ? `only ${game.bag} tiles` : 'no tiles'}: not enough to swap the rack`;
  return JSON.stringify([{ kind: 'tiles.move', body: { ...move, ...(via ? { via } : {}) } }]);
}
