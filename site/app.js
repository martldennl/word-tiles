// Word Tiles' view, in a sandboxed frame inside Weave. It gets the state its fold made ({weave: 'view', state}) and
// asks Weave for actions ({weave: 'act', id, name, input}); Weave answers {weave: 'acted', id, error?}. It has no
// network and no access to anything else: Weave signs what an action proposes, as the member, if they may.
// The rules it lays tiles by (what a move counts, whether it is legal) are fold's own: site/rules.js is made from
// src/board.js. All of it in one function: a name like `top` or `status` at script level would be the window's.
(function () {
  'use strict';
  const RULES = WordTilesRules;
  const $ = (id) => document.getElementById(id);
  const el = (tag, className = '', text = '') => Object.assign(document.createElement(tag), { className, textContent: text });
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pending = new Map();
  let next = 0;
  let me = {}; // who is looking: {did}
  let state; // what Weave last sent
  let chosen; // the game picked from the list (its id); none: the latest that is not over
  let wanted; // the name of a game I just started: it is shown once it is there
  let game; // the game that is shown
  let table = ''; // what lay on its board and rack when it was last drawn
  let hand = []; // the rack in my own order: its letters
  let fresh = new Set(); // the places on the rack that got a new tile in this drawing
  let placed = []; // my tiles lying on the board tentatively: [{slot, at}]
  let picked = null; // the place on the rack picked by a click
  let sent; // my move that Weave is signing: {n}
  let drag; // a tile in the hand
  let late = false; // the board changed while a tile was in the hand: drawn when it's let go
  let armed; // 'pass' or 'swap', asked once: the second click does it
  const seen = new Map(); // by game: what was drawn last ({moves, taken, doubts, over, scores})
  const cells = new Map(); // the board's squares, by name

  function act(name, input) {
    const id = ++next;
    window.parent.postMessage({ weave: 'act', id, name, input }, '*');
    return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
  }
  let hush;
  function say(error = '') {
    $('status').textContent = error ? String(error).replace(/^Word Tiles won't: /, '') : '';
    clearTimeout(hush);
    if (error) hush = setTimeout(say, 5000);
  }
  const show = (post) => window.parent.postMessage({ weave: 'open', post }, '*');

  // ---------------------------------------------------------------- people and tiles

  /** A color (its hue) made from a name: the same name, the same color, on every member's board. */
  const hue = (text) => [...String(text)].reduce((h, letter) => (h * 31 + letter.codePointAt(0)) % 360, 0);
  /** The players' colors: each from their name, moved on where it would be too close to one before. */
  function colors(players) {
    const all = new Map();
    for (const player of players) {
      let h = hue(player.name);
      for (let i = 0; i < 12 && [...all.values()].some((other) => Math.min(Math.abs(other - h), 360 - Math.abs(other - h)) < 50); i++) h = (h + 47) % 360;
      all.set(player.did, h);
    }
    return all;
  }
  /** A person as a round chip: their initials on their color (the frame gets no pictures of them). */
  function chip(name, h, small) {
    const words = String(name).trim().split(/\s+/);
    const c = el('span', small ? 'chip small' : 'chip', words.length > 1 ? words[0][0] + words[1][0] : words[0].slice(0, 2));
    c.style.setProperty('--h', h);
    return c;
  }
  const called = (did) => (did === me.did ? 'You' : (game.players.find((player) => player.did === did)?.name ?? '?'));
  const names = (list) => (list.length < 2 ? list.join('') : `${list.slice(0, -1).join(', ')} and ${list.at(-1)}`);

  /** A tile: its letter large, what it counts small in the corner. With a color: glazed, laid by that player. */
  function tile(letter, h) {
    const t = el('span', 'tile', letter);
    t.append(el('b', '', String(RULES.LETTERS[letter]?.[1] ?? '')));
    if (h !== undefined) {
      t.classList.add('laid');
      t.style.setProperty('--h', h);
    }
    return t;
  }

  // ---------------------------------------------------------------- the room

  /** A square's side from the room the frame has: the board as large as fits, the players beside it (under it on a phone). */
  function room() {
    const w = window.innerWidth, h = window.innerHeight;
    const phone = w < 430, wide = w >= 900;
    const side = phone ? 0 : wide ? 280 : 130;
    const across = Math.floor((w - 16 - (side ? side + 10 : 0) - 10) / 11);
    const down = Math.floor((h - 16 - (wide ? 38 : 32) - (wide ? 52 : 46) - 10) / 11);
    const s = Math.max(22, Math.min(across, phone ? across : Math.max(down, 34), 58));
    document.body.classList.toggle('phone', phone);
    document.body.classList.toggle('wide', wide);
    document.documentElement.style.setProperty('--s', `${s}px`);
    document.documentElement.style.setProperty('--side', `${side}px`);
    document.body.style.width = `${s * 11 + 10 + (side ? side + 10 : 0) + 16}px`;
  }
  window.addEventListener('resize', room);
  room();

  /** The board's squares, made once. */
  for (let y = 0; y < RULES.SIZE; y++) {
    for (let x = 0; x < RULES.SIZE; x++) {
      const at = RULES.square(x, y);
      const kind = RULES.bonus(x, y);
      const cell = el('div', `cell ${kind}${at === RULES.MIDDLE ? ' mid' : ''}`);
      cell.dataset.at = at;
      cell.title = `${at}${{ dl: ' · the letter counts double', tl: ' · the letter counts three times', dw: ' · the word counts double' }[kind] ?? ''}${at === RULES.MIDDLE ? ' · the first word goes through here' : ''}`;
      cell.addEventListener('click', () => put(at));
      cells.set(at, $('board').appendChild(cell));
    }
  }

  // ---------------------------------------------------------------- what is shown

  /** The game to show: the one picked, or the latest that is not over, or the latest. */
  function current() {
    const games = state?.games ?? [];
    return games.find((g) => g.id === chosen) ?? [...games].reverse().find((g) => !g.over) ?? games.at(-1);
  }
  const myTurn = () => Boolean(game && game.turn && game.turn === me.did);
  const canLay = () => myTurn() && !sent;
  const lastMove = () => game.moves.at(-1);

  /** My tentative tiles as the referee sees them: a legal move (its words and points), or {error}. Nothing lying: null. */
  function judged() {
    if (!placed.length) return null;
    const read = RULES.lay(game.rows, placed.map((p) => ({ at: p.at, letter: hand[p.slot] })));
    return read.error ? read : RULES.judge(game.rows, game.rack, read);
  }

  /**
   * The rack in my own order, after the game's rack changed: the letters that are still there stay where they are,
   * new ones take the places of those that went (`fresh`: these places).
   */
  function seat(gone) {
    const left = game.rack.slice();
    const kept = hand.map((letter, slot) => {
      const i = gone.includes(slot) ? -1 : left.indexOf(letter);
      if (i < 0) return null;
      left.splice(i, 1);
      return letter;
    });
    const got = new Set();
    for (let slot = 0; slot < kept.length && left.length; slot++) if (!kept[slot]) (kept[slot] = left.shift()), got.add(slot);
    while (left.length) got.add(kept.push(left.shift()) - 1);
    hand = [];
    fresh = new Set();
    kept.forEach((letter, slot) => {
      if (!letter) return; // the rack has fewer tiles than before: the bag is empty
      if (got.has(slot)) fresh.add(hand.length);
      hand.push(letter);
    });
  }

  /** Draw everything as it is now; what changed since the last drawing of this game is shown as motion. */
  function draw() {
    const from = places();
    $('fly').replaceChildren();
    const games = state?.games ?? [];
    const had = Boolean(game);
    game = current();
    if (game && !had) $('games').hidden = true;
    $('all').textContent = games.length > 1 ? `Games · ${games.length}` : 'Games';
    $('table').hidden = !game;
    $('top').hidden = !game;
    $('games').classList.toggle('alone', !game);
    if (!game) {
      $('games').hidden = false;
      listGames();
      return;
    }

    // The board or the rack changed under my tentative tiles: my own move went through (they are laid now), or they come back.
    const now = `${game.id}|${game.rows.join('')}|${[...game.rack].sort().join('')}`;
    const last = lastMove();
    const through = Boolean(sent && last && last.n === sent.n && last.by === me.did && last.move === 'play' && sent.game === game.id);
    if (now !== table) {
      const gone = through ? placed.map((p) => p.slot) : [];
      if (!table.startsWith(`${game.id}|`)) hand = [];
      placed = [];
      picked = null;
      sent = undefined;
      armed = undefined;
      seat(gone);
      table = now;
    } else fresh = new Set();

    const paint = colors(game.players);
    const move = judged();
    drawTop();
    drawBoard(paint, move);
    drawRack();
    drawSide(paint, move);
    if (!$('games').hidden) listGames();
    motion(paint, from, through);
    seen.set(game.id, { moves: game.moves.length, taken: Boolean(last?.taken), doubts: last?.doubts?.length ?? 0, over: game.over, scores: new Map(game.players.map((player) => [player.did, player.score])) });
  }

  function drawTop() {
    $('title').textContent = game.title;
    $('bag').textContent = game.bag ? `· ${game.bag} in the bag` : '· the bag is empty';
  }

  /** The board: every laid tile in its player's color, the last move's marked; my tentative tiles; what they would count. */
  function drawBoard(paint, move) {
    const last = lastMove();
    const marked = last && last.move === 'play' && !last.taken ? last.n : undefined;
    for (const cell of cells.values()) cell.replaceChildren();
    for (const node of $('board').querySelectorAll('.sum, .flag')) node.remove();
    for (const laid of game.tiles) {
      const t = tile(laid.letter, paint.get(laid.by));
      if (laid.n === marked) t.classList.add('last');
      cells.get(laid.at)?.append(t);
    }
    for (const p of placed) {
      const t = tile(hand[p.slot], paint.get(me.did) ?? 210);
      t.classList.add('mine');
      if (move?.error) t.classList.add('bad');
      if (sent) t.classList.add('sending');
      t.addEventListener('pointerdown', (e) => grab(e, t, p.slot));
      cells.get(p.at)?.append(t);
    }
    for (const cell of cells.values()) cell.classList.toggle('free', canLay() && !cell.firstChild && picked !== null);
    if (move && !move.error) {
      // What it would count, at the end of the word.
      const start = RULES.where(move.at);
      const end = cells.get(RULES.square(start.x + (move.dir === 'across' ? move.word.length - 1 : 0), start.y + (move.dir === 'down' ? move.word.length - 1 : 0)));
      const sum = el('span', 'sum', `+${move.points}`);
      sum.style.left = `${end.offsetLeft + end.offsetWidth}px`;
      sum.style.top = `${end.offsetTop}px`;
      $('board').append(sum);
    }
  }

  /** The rack: open to all, in my own order. A tile of mine that lies on the board has left its place empty. */
  function drawRack() {
    const out = new Set(placed.map((p) => p.slot));
    $('rack').classList.toggle('locked', !canLay());
    $('rack').title = canLay() ? 'Drag a tile to the board, or click it and then a square' : game.turn ? `The rack lies open to all: it is ${called(game.turn) === 'You' ? 'your' : `${called(game.turn)}'s`} turn to lay from it` : '';
    $('rack').replaceChildren(
      ...hand.map((letter, slot) => {
        const place = el('div', out.has(slot) ? 'slot out' : 'slot');
        if (out.has(slot)) return place;
        const t = place.appendChild(tile(letter));
        t.dataset.slot = slot;
        if (slot === picked) t.classList.add('picked');
        t.addEventListener('pointerdown', (e) => grab(e, t, slot));
        return place;
      }),
    );
    $('rack').hidden = !hand.length;
    for (const id of ['recall', 'shuffle', 'play']) $(id).hidden = game.over;
    $('over').hidden = !game.over;
    $('recall').disabled = !placed.length || Boolean(sent);
    $('shuffle').disabled = hand.length - placed.length < 2;
  }

  /** Beside the board: the players and their points, whose turn it is (or what my tiles would count), the last move, all moves. */
  function drawSide(paint, move) {
    const inGame = game.players.some((player) => player.did === me.did);
    $('players').replaceChildren(
      ...game.players.map((player) => {
        const li = el('li', `${player.did === game.turn ? 'turn' : ''} ${game.winners?.includes(player.did) ? 'won' : ''}`);
        li.dataset.did = player.did;
        li.style.setProperty('--h', paint.get(player.did));
        const who = el('span', 'who', player.name);
        if (player.did === me.did) who.append(el('small', '', ' (you)'));
        li.append(chip(player.name, paint.get(player.did)), who, el('span', 'score', String(player.score)));
        li.title = player.did === game.turn ? `${player.name}'s turn` : '';
        return li;
      }),
    );

    // Whose turn it is, and what there is to do.
    const now = $('now');
    now.className = '';
    const head = (text) => el('h2', '', text);
    const button = (label, className, run, title = '') => {
      const b = Object.assign(el('button', className, label), { type: 'button', title });
      b.addEventListener('click', () => run(b));
      return b;
    };
    const ask = (name, input) => (b) => {
      b.disabled = true;
      act(name, input).then(() => say(), (error) => {
        b.disabled = false;
        say(error);
      });
    };
    const acts = (...buttons) => {
      const row = el('div', 'acts');
      row.append(...buttons);
      return row;
    };
    if (game.over) {
      now.className = 'over';
      const winners = game.winners.map((did) => game.players.find((player) => player.did === did).name);
      now.replaceChildren(head(winners.length > 1 ? `A draw: ${names(winners)}` : `${game.winners[0] === me.did ? 'You win' : `${winners[0]} wins`}`), el('p', '', `${Math.max(...game.players.map((player) => player.score))} points. ${game.rack.length ? 'Everyone passed in turn.' : 'The last tile is laid.'}`));
    } else if (game.players.length < 2 || (!game.begun && !inGame)) {
      now.replaceChildren(head(inGame ? 'Waiting for players' : `${game.by}'s game`), el('p', '', inGame ? 'Two to four play. It can begin once someone has joined.' : `${game.players.length === 1 ? 'One player' : `${game.players.length} players`} so far, up to four play. It begins with the first word.`));
      if (!inGame && game.players.length < 4) now.append(acts(button('Join', 'go', ask('join', { post: game.id }))));
    } else if (!myTurn()) {
      now.replaceChildren(head(`${called(game.turn)}'s turn`), el('p', '', inGame ? `Only ${called(game.turn)} lays from the rack now.` : game.begun ? 'You are watching this game.' : 'The game begins with the first word.'));
      if (!inGame && !game.begun && game.players.length < 4) now.append(acts(button('Join', 'go', ask('join', { post: game.id }))));
    } else if (move && !move.error) {
      now.className = 'mine';
      const words = el('dl', 'words');
      for (const word of move.words) words.append(el('dt', '', word.word), el('dd', '', String(word.points)));
      if (move.all) words.append(el('dt', '', 'all seven'), el('dd', '', `+${RULES.ALL_SEVEN}`));
      if (move.words.length > 1 || move.all) words.append(el('dt', 'total', 'together'), el('dd', 'total', String(move.points)));
      now.replaceChildren(head(sent ? 'Laying it…' : 'Your move'), words);
    } else if (move) {
      now.className = 'bad';
      const error = move.error;
      now.replaceChildren(head('Not a move yet'), el('p', '', error[0].toUpperCase() + error.slice(1) + '.'));
    } else {
      now.className = 'mine';
      const go = (name) => (b) => {
        if (armed !== name) {
          armed = name;
          setTimeout(() => armed === name && ((armed = undefined), draw()), 4000); // not meant after all
          draw();
          return undefined;
        }
        armed = undefined;
        return ask(name, { post: game.id })(b);
      };
      const swap = button(armed === 'swap' ? 'Swap all seven?' : 'Swap', armed === 'swap' ? 'sure' : '', go('swap'), 'Instead of a move: seven new tiles, these go to the bottom of the bag');
      swap.disabled = game.bag < RULES.RACK;
      now.replaceChildren(head('Your turn'), el('p', '', game.tiles.length ? 'Drag tiles from the rack onto the board.' : 'Lay the first word through the middle.'), acts(button(armed === 'pass' ? 'Pass, sure?' : 'Pass', armed === 'pass' ? 'sure' : '', go('pass'), 'Lay nothing this turn'), swap));
    }

    // The last move: who, what it counted, the word. The others may doubt it until the next move is made.
    const last = lastMove();
    const card = $('last');
    card.hidden = !last;
    if (last) {
      card.className = last.taken ? 'taken' : '';
      card.style.setProperty('--h', paint.get(last.by));
      const line = el('div', 'line');
      const via = last.via ? ` · via ${last.via}` : '';
      if (last.move === 'play') {
        line.append(el('b', '', last.taken ? '±0' : `+${last.points}`), chip(last.name, paint.get(last.by), true), called(last.by));
        const word = el('span', 'word', last.word);
        if (last.via) word.append(el('small', '', `via ${last.via}`));
        word.title = last.words.map((w) => `${w.word} ${w.points}`).join(' · ') + (last.all ? ` · all seven +${RULES.ALL_SEVEN}` : '');
        card.replaceChildren(line, word);
        if (last.taken) card.append(el('p', '', `Taken back: ${names(last.doubts.map((doubt) => (doubt.by === me.did ? 'you' : doubt.name)))} doubted it.`));
        else {
          if (last.doubts.length) {
            const doubts = el('div', 'doubts');
            doubts.append(...last.doubts.map((doubt) => chip(doubt.name, paint.get(doubt.by), true)), `${last.doubts.length} of ${game.doubts} doubt it`);
            card.append(doubts);
          }
          const mine = last.doubts.some((doubt) => doubt.by === me.did);
          if (inGame && last.by !== me.did && !mine) card.append(acts(button('Doubt it', 'doubt', ask('doubt', { post: game.id }), `Not a word? If ${game.doubts === 1 ? 'you doubt it' : `${game.doubts} of the others doubt it`}, it is taken back`)));
        }
      } else {
        line.append(chip(last.name, paint.get(last.by), true), `${called(last.by)} ${last.move === 'pass' ? 'passed' : 'swapped the rack'}${via}`);
        card.replaceChildren(line);
      }
    }

    // All moves, the latest first.
    $('moves').replaceChildren(
      ...[...game.moves].reverse().map((m) => {
        const li = el('li');
        li.style.setProperty('--h', paint.get(m.by));
        const what = el('span', m.move === 'play' ? 'what' : 'what soft');
        if (m.move !== 'play') what.textContent = m.move === 'pass' ? 'passed' : 'swapped';
        else if (m.taken) what.append(el('s', '', m.word));
        else what.textContent = m.word;
        if (m.via) what.append(el('small', '', ` via ${m.via}`));
        li.title = `${m.name}${m.move === 'play' ? `: ${m.words.map((w) => `${w.word} ${w.points}`).join(', ')}${m.taken ? ' (taken back)' : ''}` : m.move === 'pass' ? ' passed' : ' swapped the rack'}`;
        li.append(el('span', 'n', String(m.n)), el('i'), what, el('span', 'points', m.move !== 'play' ? '' : m.taken ? '±0' : `+${m.points}`));
        return li;
      }),
    );

    const ready = Boolean(canLay() && move && !move.error);
    $('play').disabled = !ready;
    $('play').classList.toggle('asking', Boolean(sent));
    $('play').textContent = sent ? 'Laying…' : ready ? `Play ${move.word} · ${move.points}` : 'Play';
    if (ready && $('play').scrollWidth > $('play').clientWidth) $('play').textContent = `Play · ${move.points}`;
  }

  /** All games on the board, the latest first: pick one to show, join one that waits; and a new one. */
  function listGames() {
    const games = state?.games ?? [];
    $('list').replaceChildren(
      ...[...games].reverse().map((g) => {
        const paint = colors(g.players);
        const li = el('li', g.id === game?.id ? 'shown' : '');
        const about = el('span', 'about');
        const winners = (g.winners ?? []).map((did) => g.players.find((player) => player.did === did).name);
        about.append(...g.players.map((player) => chip(player.name, paint.get(player.did), true)), ' ', g.over ? `over · ${names(winners)} ${winners.length > 1 ? 'drew' : 'won'}` : !g.begun ? (g.players.length < 2 ? 'waits for players' : 'ready to begin') : `${g.players.find((player) => player.did === g.turn)?.name}'s turn · move ${g.n}`);
        li.append(el('span', 'name', g.title), about);
        if (!g.begun && g.players.length < 4 && !g.players.some((player) => player.did === me.did)) {
          const join = Object.assign(el('button', 'go', 'Join'), { type: 'button' });
          join.addEventListener('click', (e) => {
            e.stopPropagation();
            join.disabled = true;
            chosen = g.id;
            act('join', { post: g.id }).then(() => say(), say);
          });
          const row = el('div', 'acts');
          row.append(join);
          li.append(row);
        }
        li.addEventListener('click', () => {
          chosen = g.id;
          $('games').hidden = true;
          draw();
        });
        li.addEventListener('dblclick', () => show(g.id));
        return li;
      }),
    );
  }

  // ---------------------------------------------------------------- motion

  /** Where the tiles are on the screen now: those on the rack (by place) and those on the board (by square). */
  function places() {
    const rack = [...document.querySelectorAll('#rack .tile')].map((t) => ({ letter: t.firstChild.textContent, rect: t.getBoundingClientRect() }));
    const board = new Map([...document.querySelectorAll('#board .cell > .tile')].map((t) => [t.parentNode.dataset.at, t.getBoundingClientRect()]));
    return { rack, board };
  }

  /** A tile on its way from one place to another, above everything; `then` once it is there. Shaken first, if it is doubted. */
  function fly(letter, h, from, to, wait, shaken, then) {
    const g = tile(letter, h);
    g.classList.add('ghost');
    Object.assign(g.style, { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px` });
    $('fly').append(g);
    const dx = to.left - from.left, dy = to.top - from.top;
    if (shaken) g.animate([{ translate: '0 0', rotate: '0deg' }, { translate: '-3px 0', rotate: '-7deg' }, { translate: '3px 0', rotate: '7deg' }, { translate: '-3px 0', rotate: '-6deg' }, { translate: '3px 0', rotate: '5deg' }, { translate: '0 0', rotate: '0deg' }], { duration: shaken });
    const flight = g.animate([{ translate: '0 0', scale: 1 }, { translate: `${dx * 0.5}px ${dy * 0.5 - 22}px`, scale: 1.3, offset: 0.5 }, { translate: `${dx}px ${dy}px`, scale: 1 }], { duration: 400, delay: wait + shaken, easing: 'cubic-bezier(.35, .05, .25, 1)', fill: 'both' });
    flight.onfinish = () => {
      g.remove();
      then();
    };
  }

  /** A number counts up (or down) to where it is now. */
  function countTo(node, from, to, wait) {
    if (from === to || still) return;
    node.textContent = from;
    setTimeout(() => {
      const began = performance.now();
      const step = (time) => {
        const k = Math.min(1, (time - began) / 700);
        node.textContent = Math.round(from + (to - from) * (1 - (1 - k) ** 3));
        if (k < 1 && node.isConnected) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, wait);
  }

  /** What changed since this game was last drawn, shown as motion. */
  function motion(paint, from, through) {
    const before = seen.get(game.id);
    const last = lastMove();
    if (!before || still) return;
    let wait = 0; // how long the tiles take: the points count after that
    const tileAt = (at) => cells.get(at)?.querySelector('.tile');
    const wordTiles = (move) => {
      const start = RULES.where(move.at);
      return [...move.word].map((_, i) => tileAt(RULES.square(start.x + (move.dir === 'across' ? i : 0), start.y + (move.dir === 'down' ? i : 0)))).filter(Boolean);
    };

    if (game.moves.length > before.moves && last.move === 'play' && !last.taken) {
      // A word was laid. Mine, by hand: the tiles lie there already and settle with a clack. A friend's (or my agent's):
      // they come over from the rack, one after another.
      const rack = from.rack.slice();
      last.tiles.forEach((laid, i) => {
        const t = tileAt(laid.at);
        if (!t) return;
        const at = rack.findIndex((r) => r.letter === laid.letter);
        if (through || at < 0) {
          t.classList.add(through ? 'clack' : 'land');
          t.style.setProperty('--i', i);
          t.style.setProperty('--wait', `${i * 80}ms`);
          return;
        }
        const [start] = rack.splice(at, 1);
        t.classList.add('wait');
        fly(laid.letter, paint.get(last.by), start.rect, t.getBoundingClientRect(), i * 130, 0, () => {
          t.classList.remove('wait');
          t.classList.add('clack');
        });
      });
      wait = through ? last.tiles.length * 80 + 200 : last.tiles.length * 130 + 420;
      // Then the whole word lifts for a moment, and says who laid it.
      wordTiles(last).forEach((t, i) => {
        const lift = () => {
          t.classList.remove('clack', 'land');
          t.style.setProperty('--i', i);
          t.style.setProperty('--wait', '0ms');
          t.classList.add('lift');
        };
        setTimeout(() => t.isConnected && lift(), wait);
      });
      if (last.by !== me.did || last.via) flag(last, paint.get(last.by), wait);
      for (const t of document.querySelectorAll('#rack .tile')) {
        if (!fresh.has(+t.dataset.slot)) continue;
        t.classList.add('pop');
        t.style.setProperty('--wait', `${wait + 150}ms`);
      }
      wait += 250;
    } else if (last?.taken && !(before.taken && before.moves === game.moves.length)) {
      // A word was doubted and taken back: its tiles shake and fly back to the rack.
      const rack = [...document.querySelectorAll('#rack .tile')].filter((t) => fresh.has(+t.dataset.slot));
      last.tiles.forEach((laid, i) => {
        const start = from.board.get(laid.at) ?? cells.get(laid.at).getBoundingClientRect();
        const back = rack.findIndex((t) => t.firstChild.textContent === laid.letter);
        if (back < 0) return;
        const [home] = rack.splice(back, 1);
        home.classList.add('wait');
        fly(laid.letter, paint.get(last.by), start, home.getBoundingClientRect(), i * 70, 560, () => {
          home.classList.remove('wait');
          home.classList.add('clack');
        });
      });
      $('last').classList.add('pop');
      wait = 500;
    } else if (last?.doubts && before.moves === game.moves.length && last.doubts.length > before.doubts) {
      // Someone doubts the last word: it trembles.
      for (const t of wordTiles(last)) t.classList.add('wobble');
      $('last').classList.add('pop');
    } else if (game.moves.length > before.moves) {
      $('last').classList.add('pop');
      if (last.move === 'swap') {
        for (const t of document.querySelectorAll('#rack .tile')) {
          t.classList.add('pop');
          t.style.setProperty('--wait', `${+t.dataset.slot * 60}ms`);
        }
      }
    }

    // The points count to where they are now; what was won (or lost) rises from them.
    for (const li of $('players').children) {
      const player = game.players.find((p) => p.did === li.dataset.did);
      const was = before.scores.get(player.did) ?? player.score;
      if (was === player.score) continue;
      countTo(li.querySelector('.score'), was, player.score, wait);
      const gain = el('span', player.score < was ? 'gain loss' : 'gain', `${player.score > was ? '+' : '−'}${Math.abs(player.score - was)}`);
      gain.style.setProperty('--wait', `${wait}ms`);
      li.append(gain);
    }

    // The game is over: a small burst for whoever won.
    if (game.over && !before.over) {
      for (const li of $('players').querySelectorAll('.won')) {
        const b = el('span', 'burst');
        for (let i = 0; i < 28; i++) b.appendChild(el('i')).style.cssText = `--turn: ${i * 12.86 + 5}deg; --far: ${46 + (i % 4) * 26}px; --c: ${(i * 47) % 360}; --wait: ${wait + 500 + (i % 4) * 70}ms`;
        li.append(b);
        li.classList.add('cheer');
        li.style.setProperty('--wait', `${wait + 450}ms`);
        $('now').classList.add('cheer');
        $('now').style.setProperty('--wait', `${wait + 450}ms`);
      }
    }
  }

  /** For a moment, at its word: who laid it and what it counted (a friend did it, or my agent). */
  function flag(move, h, wait) {
    const start = cells.get(move.at);
    const f = el('span', 'flag');
    f.style.setProperty('--h', h);
    f.style.setProperty('--wait', `${wait}ms`);
    f.append(chip(move.name, h, true), move.by === me.did ? 'You' : move.name, el('em', '', `+${move.points}`));
    if (move.via) f.append(el('small', '', `via ${move.via}`));
    // Above the word's beginning, or under it (under its end, if it runs down): where fewer tiles lie.
    const { x, y } = RULES.where(move.at);
    const under = y + (move.dir === 'down' ? move.word.length : 1);
    const lying = (row) => (row < 0 || row >= RULES.SIZE ? 0.5 : [0, 1, 2, 3].filter((i) => cells.get(RULES.square(Math.min(x + i, RULES.SIZE - 1), row)).firstChild).length);
    const above = lying(y - 1) <= lying(under);
    f.style.left = `${Math.max(0, Math.min(start.offsetLeft, $('board').offsetWidth - 150))}px`;
    f.style.top = `${above ? start.offsetTop - 27 : start.offsetTop + (under - y) * (start.offsetHeight + 1) + 2}px`;
    $('board').append(f);
    setTimeout(() => f.remove(), wait + 3700);
  }

  // ---------------------------------------------------------------- laying by hand

  /** It is not my turn (or my move is on its way): say so, where whose turn it is stands. */
  function nudge() {
    const now = $('now');
    now.classList.remove('nudge');
    void now.offsetWidth;
    now.classList.add('nudge');
  }

  /** Lay the picked tile on a square (a click on the rack picks one, a click on a free square lays it). */
  function put(at) {
    if (drag || picked === null || !canLay() || cells.get(at).firstChild) return;
    placed.push({ slot: picked, at });
    picked = null;
    draw();
  }

  /** A press on a tile, on the rack or lying tentatively: moved, it follows the pointer until it's let go; not moved, it was a click. */
  function grab(down, t, slot) {
    if (down.button) return;
    down.preventDefault();
    if (!canLay()) return nudge();
    const lying = placed.find((p) => p.slot === slot);
    let moved = false;
    let over;
    const target = (e) => document.elementsFromPoint(e.clientX, e.clientY).find((n) => n.classList?.contains('cell'));
    const move = (e) => {
      if (!moved && Math.hypot(e.clientX - down.clientX, e.clientY - down.clientY) < 5) return;
      if (!moved) {
        moved = true;
        drag = { slot };
        t.classList.add('dragging');
      }
      t.style.translate = `${e.clientX - down.clientX}px ${e.clientY - down.clientY}px`;
      const cell = target(e);
      const free = cell && (!cell.firstChild || cell.firstChild === t) ? cell : undefined;
      if (free !== over) {
        over?.classList.remove('over');
        over = free;
        over?.classList.add('over');
      }
    };
    const end = (e) => {
      for (const [type, listener] of listeners) t.removeEventListener(type, listener);
      over?.classList.remove('over');
      drag = undefined;
      if (!moved) {
        // A click: a tile on the rack is picked (or let go again), one lying on the board goes back to the rack.
        if (lying) placed = placed.filter((p) => p !== lying);
        else picked = picked === slot ? null : slot;
      } else if (e.type === 'pointerup') {
        const cell = target(e);
        const onRack = document.elementsFromPoint(e.clientX, e.clientY).some((n) => n.id === 'hand');
        if (cell && !cell.firstChild) {
          placed = placed.filter((p) => p !== lying);
          placed.push({ slot, at: cell.dataset.at });
          picked = null;
        } else if (lying && (onRack || !cell)) placed = placed.filter((p) => p !== lying);
      }
      late = false;
      draw();
    };
    const listeners = [['pointermove', move], ['pointerup', end], ['pointercancel', end]];
    for (const [type, listener] of listeners) t.addEventListener(type, listener);
    t.setPointerCapture(down.pointerId);
    return undefined;
  }
  // While a tile is dragged by a finger, nothing scrolls.
  document.addEventListener('touchmove', (e) => drag && e.preventDefault(), { passive: false });

  $('recall').addEventListener('click', () => {
    placed = [];
    picked = null;
    draw();
  });
  $('shuffle').addEventListener('click', () => {
    // Only the tiles that are on the rack change places; only for me.
    const out = new Set(placed.map((p) => p.slot));
    const slots = hand.map((_, slot) => slot).filter((slot) => !out.has(slot));
    const letters = slots.map((slot) => hand[slot]);
    for (let i = letters.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [letters[i], letters[j]] = [letters[j], letters[i]];
    }
    slots.forEach((slot, i) => (hand[slot] = letters[i]));
    picked = null;
    draw();
    for (const t of document.querySelectorAll('#rack .tile')) t.classList.add('clack');
  });
  $('play').addEventListener('click', () => {
    const move = judged();
    if (!canLay() || !move || move.error) return;
    sent = { n: game.n, game: game.id };
    const mine = sent;
    draw();
    act('play', { post: game.id, word: move.word, at: move.at, dir: move.dir }).then(
      // Signed: the board comes with it. If it doesn't (the move didn't count after all), the tiles are mine again.
      () => setTimeout(() => sent === mine && ((sent = undefined), draw()), 4000),
      (error) => {
        if (sent === mine) sent = undefined;
        say(error);
        draw();
      },
    );
  });

  // ---------------------------------------------------------------- all games, and a new one

  $('title').addEventListener('dblclick', () => game && show(game.id));
  $('all').addEventListener('click', () => {
    $('games').hidden = !$('games').hidden;
    if (!$('games').hidden) listGames();
  });
  document.addEventListener('pointerdown', (e) => {
    if (game && !$('games').hidden && !e.target.closest('#games, #all')) $('games').hidden = true;
  });
  /** A seed word for a new game's bag: made here, by chance (the lens itself has none). */
  function seed() {
    const any = (list) => list[Math.floor(Math.random() * list.length)];
    return `${any(['amber', 'brisk', 'calm', 'dusty', 'early', 'faint', 'green', 'happy', 'ivory', 'jolly', 'kind', 'late', 'merry', 'north', 'odd', 'plain', 'quiet', 'round', 'slow', 'tidy'])}-${any(['anchor', 'bell', 'cloud', 'door', 'ember', 'fox', 'gate', 'hill', 'ink', 'kite', 'lamp', 'moon', 'nest', 'owl', 'path', 'river', 'stone', 'tower', 'wave', 'yard'])}-${10 + Math.floor(Math.random() * 90)}`;
  }
  function start() {
    const title = $('name').value.trim();
    if (!title) return $('name').focus();
    $('start').disabled = true;
    return act('new', { title, seed: seed() }).then(
      () => {
        wanted = title;
        $('name').value = '';
        $('start').disabled = false;
        say();
        pick();
      },
      (error) => {
        $('start').disabled = false;
        say(error);
      },
    );
  }
  /** The game I just started is shown as soon as it is on the board. */
  function pick() {
    const mine = wanted && [...(state?.games ?? [])].reverse().find((g) => g.author === me.did && g.title === wanted);
    if (!mine) return;
    chosen = mine.id;
    wanted = undefined;
    $('games').hidden = true;
    draw();
  }
  $('start').addEventListener('click', start);
  $('name').addEventListener('keydown', (e) => e.key === 'Enter' && start());

  // ---------------------------------------------------------------- talking to Weave

  window.addEventListener('message', (event) => {
    if (event.source !== window.parent) return;
    const m = event.data;
    if (m?.weave === 'view' && Array.isArray(m.state?.games)) {
      me = m.me ?? {};
      state = m.state;
      pick();
      if (drag) late = true; // a tile in the hand stays there: the board is drawn anew when it's let go
      else draw();
    }
    if (m?.weave === 'acted' && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id);
      pending.delete(m.id);
      if (m.error) reject(m.error);
      else resolve();
    }
  });
})();
