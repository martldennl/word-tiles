// Photographs of the preview, into preview/out/: the game in a board's room (540 × 480) in its middle and at its
// end, dark and light; in a window of its own (1050 wide); on a phone; a game just made, and a board without one;
// the list of games. Then the last part of the sample game, played as Weave shows it (sandboxed) with a real
// pointer where Mara acts herself: she drags tiles from the rack (what they would count shows), presses Play, a
// friend's word arrives, one is doubted (she clicks "Doubt it") and flies back, her agent lays a word, the last
// tiles are laid. Four of these moments on one sheet. It starts the preview's server and a headless Chrome (through
// the videos' tools/cdp.js) and stops both again.
//
//   node preview/shoot.js
import { mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { GAME } from './sample.js';
import { serve } from './serve.js';

const { launch } = createRequire(import.meta.url)(process.env.CDP ?? '../../tools/cdp.js');
const file = (name) => fileURLToPath(new URL(`out/${name}.png`, import.meta.url));
const page = (query = '') => `http://127.0.0.1:8844/preview/${query}`;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
mkdirSync(fileURLToPath(new URL('out/', import.meta.url)), { recursive: true });
// The lens's own rules, to know which tiles a step of the sample lays.
const rules = {};
vm.runInNewContext(readFileSync(fileURLToPath(new URL('../site/rules.js', import.meta.url)), 'utf8'), rules);

const server = await serve();
const b = await launch({ width: 600, height: 590, port: 9454 });
b.on((m) => m.method === 'Runtime.exceptionThrown' && console.log('error in the page:', m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text));
const scheme = (value) => b.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value }] });
/** The preview with a frame of this size, in a window that fits it, photographed. */
async function shoot(name, width, height, query = '', theme = 'dark') {
  await scheme(theme);
  await b.size(width + 60, height + 110);
  await b.goto(page(`?theme=${theme}&w=${width}&h=${height}${query}`), 1200);
  await b.shot(file(name));
}
const mouse = (type, x, y, clickCount = 1) => b.send('Input.dispatchMouseEvent', { type, x, y, button: type === 'mouseMoved' ? 'none' : 'left', buttons: type === 'mouseReleased' ? 0 : type === 'mousePressed' ? 1 : 0, clickCount });
const click = async ({ x, y }, count = 1) => {
  await mouse('mouseMoved', x, y);
  await wait(60);
  for (let i = 1; i <= count; i++) {
    await mouse('mousePressed', x, y, i);
    await mouse('mouseReleased', x, y, i);
  }
};
/** Press on one place, move to another in a few steps, let go: as a hand drags a tile. */
async function dragTo(from, to) {
  await mouse('mouseMoved', from.x, from.y);
  await mouse('mousePressed', from.x, from.y);
  for (let i = 1; i <= 8; i++) {
    await b.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: from.x + ((to.x - from.x) * i) / 8, y: from.y + ((to.y - from.y) * i) / 8, button: 'left', buttons: 1 });
    await wait(25);
  }
  await mouse('mouseReleased', to.x, to.y);
  await wait(120);
}
/**
 * Where things are in the lens, in the window's own coordinates: asked of a twin of the page whose frame is not
 * sandboxed (the same layout), after the same steps; the sandboxed one is then used by these places alone.
 */
async function measure(query, steps, what) {
  await b.goto(page(`${query}&sandbox=0`), 1000);
  for (const step of steps) {
    await b.eval(`scene[${step}]()`);
    await wait(150);
  }
  await wait(1500);
  return b.eval(`(() => { const f = document.getElementById('lens'), o = f.getBoundingClientRect(), doc = f.contentWindow.document; const mid = (n) => { const r = n.getBoundingClientRect(); return { x: o.left + r.left + r.width / 2, y: o.top + r.top + r.height / 2 }; }; ${what} })()`);
}
const game = () => b.eval('look().games.at(-1)');

try {
  const middle = Math.round(GAME.scene * 0.6);
  await shoot('540-dark-middle', 540, 480, `&at=${middle}`);
  await shoot('540-dark-end', 540, 480, '&end=1');
  await shoot('540-light-middle', 540, 480, `&at=${middle}`, 'light');
  await shoot('540-light-end', 540, 480, '&end=1', 'light');
  await shoot('1050-dark', 1050, 900, '');
  await shoot('1050-light', 1050, 900, '&end=1', 'light');
  await shoot('narrow-dark', 390, 780, '');
  await shoot('narrow-light', 390, 780, `&at=${middle}`, 'light');
  await shoot('fresh-540', 540, 480, '&fresh=1');
  await shoot('watching-540', 540, 480, '&fresh=1&me=nobody');
  await shoot('empty-540', 540, 480, '&empty=1');

  // The last part, with a real pointer in the sandboxed frame. First: where the squares, the rack's places and Play are.
  await scheme('dark');
  await b.size(600, 590);
  const spots = await measure('?theme=dark', [], `return { cells: Object.fromEntries([...doc.querySelectorAll('.cell')].map((c) => [c.dataset.at, mid(c)])), rack: [...doc.querySelectorAll('#rack .slot')].map(mid), play: mid(doc.getElementById('play')), all: mid(doc.getElementById('all')), title: mid(doc.getElementById('title')) }`);
  await b.goto(page('?theme=dark'), 1200);
  await b.shot(file('540-dark-my-turn'));
  // Mara's move by hand: the tiles its step lays, each dragged from its place on the rack (the rack lies in the bag's order).
  const before = await game();
  const mine = rules.WordTilesRules.judge(before.rows, before.rack, GAME.steps[GAME.scene].input);
  const rack = [...before.rack];
  for (const [i, tile] of mine.tiles.entries()) {
    const slot = rack.indexOf(tile.letter);
    rack[slot] = null;
    await dragTo(spots.rack[slot], spots.cells[tile.at]);
    if (i === 0) await b.shot(file('laying-first'));
  }
  await wait(200);
  await b.shot(file('tentative'));
  await b.shot(file('scene-1'));
  await click(spots.play);
  await wait(330);
  await b.shot(file('played-clack'));
  await wait(450);
  await b.shot(file('played-lift'));
  await wait(1500);
  const after = await game();
  console.log(`by hand: ${after.moves.at(-1).name} laid ${after.moves.at(-1).word} for ${after.moves.at(-1).points}: ${after.moves.at(-1).word === GAME.steps[GAME.scene].input.word ? 'as the sample has it' : 'NOT what the sample has'}`);
  await b.shot(file('played'));

  // A friend's word arrives: its tiles come over from the rack, it says who laid it. And so on up to the word that is none.
  const none = GAME.steps.findIndex((step, i) => GAME.steps[i + 1]?.action === 'doubt');
  let step = 1; // scene[0] is the move just made by hand
  for (; GAME.scene + step < none; step++) {
    await b.eval(`scene[${step}]()`);
    if (step === 1) {
      await wait(330);
      await b.shot(file('arriving-flight'));
      await wait(GAME.steps[GAME.scene + 1].input.word.length * 130 + 500);
      await b.shot(file('scene-2'));
      await wait(1900);
      await b.shot(file('arrived'));
    } else await wait(2600);
  }
  await b.eval(`scene[${step++}]()`); // the word that is none
  await wait(2800);
  await b.eval(`scene[${step++}]()`); // a friend doubts it
  await wait(250);
  await b.shot(file('doubt-wobble'));
  await wait(900);
  await b.shot(file('doubt'));
  // Mara doubts it too, with a click: where "Doubt it" is, the twin knows.
  const doubt = await measure('?theme=dark', Array.from({ length: step }, (_, i) => i), `return mid(doc.querySelector('.doubt'))`);
  await b.goto(page('?theme=dark'), 1000);
  for (let i = 0; i < step; i++) await b.eval(`scene[${i}]()`);
  await wait(2500);
  await click(doubt);
  await wait(420);
  await b.shot(file('taken-back-shake'));
  await wait(330);
  await b.shot(file('scene-3'));
  await wait(1500);
  await b.shot(file('taken-back'));
  console.log(`doubted with a click: ${(await game()).moves.at(-1).taken ? 'taken back' : 'NOT taken back'}`);
  step++; // scene[step] was Mara's doubt: done by hand
  // The others' words, then Mara's agent's (it says "via claude"), then the rest, to the last tile.
  for (; GAME.scene + step < GAME.steps.length; step++) {
    const via = GAME.steps[GAME.scene + step].input.via;
    const last = GAME.scene + step === GAME.steps.length - 1;
    await b.eval(`scene[${step}]()`);
    await wait(via ? GAME.steps[GAME.scene + step].input.word.length * 130 + 800 : last ? 2100 : 2600);
    if (via) await b.shot(file('agent'));
    if (via) await wait(2200);
    if (last) await b.shot(file('scene-4'));
  }
  await wait(2500);
  await b.shot(file('540-dark-over'));
  // The list of games, and a double-click on the game's name.
  await click(spots.all);
  await wait(300);
  await b.shot(file('games'));
  await click(spots.all);
  await click(spots.title, 2);
  await wait(300);
  await b.shot(file('open'));
  await b.size(1200, 1180);
  await b.goto(page('sheet.html'), 800);
  await b.shot(file('scene-sheet'));
} finally {
  b.close();
  server.closeAllConnections();
  server.close();
}
