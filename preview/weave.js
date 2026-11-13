// Weave's part, played for the lens, to look at it without Weave: it keeps a board's events, folds them with the real
// fold, sends the frame {weave: 'view'}, and answers its {weave: 'act'} by running the real act, checking what it
// proposes against the contract (weave.app.json), "signing" it as Mara and folding again.
//
// The board holds the sample game (preview/sample.js), replayed step by step through the lens's own actions, up to
// where its last part begins (it is Mara's turn), and a short earlier game.
//
//   ?play=1        the last part plays by itself: Mara lays a word, Jonas's word arrives, Aylin's is doubted and
//                  taken back, Tobi lays one, Mara's agent lays one for her, and the last tiles are laid
//   ?at=12         the game after its first 12 steps      ?end=1   the whole game, over
//   ?fresh=1       the game just made: three have joined, nothing is laid      ?empty=1   a board without a game
//   ?me=tobi       look as someone else (Mara otherwise)
//   ?theme=light   light instead of dark        ?w=1050&h=900   the frame's size (540 × 480: a board's room in Weave)
//   ?sandbox=0     the frame unsandboxed, to look into it from outside (never how Weave shows it)
import { act, fold } from '../src/board.js';
import { board, did, EARLIER, GAME, people } from './sample.js';

const params = new URLSearchParams(location.search);
const frame = document.getElementById('lens');
const manifest = await (await fetch('../weave.app.json')).json();
const ME = params.get('me') ?? 'mara';
const MIN = 60_000;

// ---------------------------------------------------------------- Weave's part

const items = [];
/** An event as the fold gets it, signed by one of the four at some time (left out: now). Its id. */
function sign(who, kind, body, time = Date.now()) {
  items.push({ id: `e${String(items.length + 1).padStart(3, '0')}`, kind, body, author: did(who), authorName: people[who], time: new Date(time).toISOString() });
  return items.at(-1).id;
}

/** The state: the events, oldest first as Weave hands them over, folded. */
const folded = () => fold(JSON.stringify(board), JSON.stringify([...items].sort((a, b) => a.time.localeCompare(b.time) || a.id.localeCompare(b.id))));

/** Send the frame the view, as whenever the board changes. */
function view() {
  const state = JSON.parse(folded());
  frame.contentWindow.postMessage({ weave: 'view', state, actions: state.actions, board, me: { did: did(ME) } }, '*');
}

/** An action, by one of the four: what the lens proposes is checked against its contract, as Weave does, and signed. The new events' ids. */
function action(who, name, input, time) {
  let proposed;
  try {
    proposed = JSON.parse(act(name, JSON.stringify(input ?? null), folded(), JSON.stringify({ did: did(who), name: people[who] })));
  } catch (error) {
    throw new Error(`${manifest.name} won't: ${error instanceof Error ? error.message : error}`);
  }
  const posts = new Set(items.filter((item) => item.kind === 'weave.post').map((item) => item.id));
  for (const { kind, body } of proposed) {
    if (!manifest.client.writes.includes(kind)) throw new Error(`${manifest.name} may not propose ${kind} (its contract: ${manifest.client.writes.join(', ')})`);
    const about = body.post ?? body.target;
    if (about !== undefined && !posts.has(about)) throw new Error(`${manifest.name} proposed a ${kind} about something not in ${board.title}`);
  }
  // What is about no post belongs to the board: Weave writes the board's name into it.
  return proposed.map(({ kind, body }) => sign(who, kind, body.post ?? body.target ? body : { ...body, board: board.name }, time));
}

// ---------------------------------------------------------------- the sample: an earlier game, and the game of the four

/** A game replayed: its steps as `act` takes them, '$game' standing for its post (the first step makes it). The steps not yet done, as functions. */
function replay(game, upTo, ago) {
  let post;
  const run = (step, time) => {
    const ids = action(step.who, step.action, JSON.parse(JSON.stringify(step.input).replaceAll('$game', post)), time);
    post ??= ids[0];
  };
  // One step every three minutes, the last one a moment ago.
  game.steps.slice(0, upTo).forEach((step, i) => run(step, Date.now() - ago - (upTo - i) * 3 * MIN));
  return game.steps.slice(upTo).map((step) => () => {
    run(step);
    view();
  });
}

const upTo = params.has('empty') ? 0 : params.has('fresh') ? GAME.players.length : params.has('end') ? GAME.steps.length : +(params.get('at') ?? GAME.scene);
if (!params.has('empty')) replay(EARLIER, EARLIER.steps.length, 26 * 60 * MIN);
/** What is still to come in the game, one step after the other: ?play=1 plays them; window.scene[i]() does one. */
window.scene = replay(GAME, upTo, MIN);
// To look at and try from the console: what was signed, the state, and the contract (take a kind out of it: Weave refuses it).
window.items = items;
window.look = () => JSON.parse(folded());
window.contract = manifest.client.writes;

// ---------------------------------------------------------------- the lens asks

const note = (text) => {
  const n = document.getElementById('note');
  n.textContent = text;
  n.classList.add('on');
  setTimeout(() => n.classList.remove('on'), 2500);
};

window.addEventListener('message', (event) => {
  if (event.source !== frame.contentWindow) return;
  const m = event.data;
  // A moment passes while Weave signs: the lens has to look right in the meantime.
  if (m?.weave === 'act') {
    setTimeout(() => {
      try {
        action(ME, m.name, m.input);
        frame.contentWindow.postMessage({ weave: 'acted', id: m.id }, '*');
        view();
      } catch (error) {
        frame.contentWindow.postMessage({ weave: 'acted', id: m.id, error: error.message }, '*');
        note(error.message);
      }
    }, 150);
  }
  if (m?.weave === 'open') note(`Weave would open “${items.find((item) => item.id === m.post)?.body.title}”`);
});

document.documentElement.classList.toggle('light', params.get('theme') === 'light');
frame.style.colorScheme = params.get('theme') === 'light' ? 'light' : 'dark';
frame.width = params.get('w') ?? 540;
frame.height = params.get('h') ?? 480;
if (params.get('sandbox') === '0') frame.removeAttribute('sandbox');
frame.addEventListener('load', () => {
  view();
  // A word takes its time; a doubt comes quicker.
  if (params.get('play')) {
    let when = 1600;
    window.scene.forEach((step, i) => {
      setTimeout(step, when);
      when += GAME.steps[upTo + i + 1]?.action === 'doubt' ? 2200 : 3400;
    });
  }
});
frame.src = '../site/index.html';
