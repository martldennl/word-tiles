// The sample game, to look at the lens without Weave and to replay it anywhere: a whole game of four friends, valid
// under the lens's own rules with the bag its seed word gives. Found by tmp/solve.mjs, written and checked by
// tmp/write-sample.mjs (which replays these steps through act and fold); every word that stands is a plain everyday one.
//
// Each step is {who, action, input} exactly as `act` takes it: `weave board act <board> <action> --input '<input>'`,
// by that person. '$game' stands for the game's post: the id of the post the first step makes. Nothing else depends
// on that id. The steps in their order are the whole game: Mara starts it, the others join, then the turns go round.
// In it: one swap (step 15), one word that is none (BEED, Tobi's: two of the others doubt it and it is taken back), one move
// by Mara's agent ("via claude"), and the last tile laid in the last step. It ends: Mara 95, Jonas 110, Aylin 87, Tobi 119.
export const board = { name: 'games', title: 'Games' };
export const people = { mara: 'Mara', jonas: 'Jonas', aylin: 'Aylin', tobi: 'Tobi' };
export const did = (who) => `did:key:${who}`;

export const GAME = {
  title: 'Friday round',
  seed: 'bright-wind-139',
  players: ['mara', 'jonas', 'aylin', 'tobi'],
  // Where its last part begins (preview: ?play=1 plays from here on; before it, it is Mara's turn): the index of the
  // step in which Mara lays a word by hand. Then a friend's word, the word that is none and the two doubts that take
  // it back, the move by Mara's agent, and the last tiles.
  scene: 20,
  steps: [
    { who: 'mara', action: 'new', input: { title: 'Friday round', seed: 'bright-wind-139' } },
    { who: 'jonas', action: 'join', input: { post: '$game' } },
    { who: 'aylin', action: 'join', input: { post: '$game' } },
    { who: 'tobi', action: 'join', input: { post: '$game' } },
    { who: 'mara', action: 'play', input: { post: '$game', word: 'ACT', at: 'F6', dir: 'across' } },
    { who: 'jonas', action: 'play', input: { post: '$game', word: 'LAZY', at: 'F5', dir: 'down' } },
    { who: 'aylin', action: 'play', input: { post: '$game', word: 'JOT', at: 'H4', dir: 'down' } },
    { who: 'tobi', action: 'play', input: { post: '$game', word: 'ANGRY', at: 'B8', dir: 'across' } },
    { who: 'mara', action: 'play', input: { post: '$game', word: 'ROAR', at: 'B6', dir: 'down' } },
    { who: 'jonas', action: 'play', input: { post: '$game', word: 'EXACT', at: 'D6', dir: 'across' } },
    { who: 'aylin', action: 'play', input: { post: '$game', word: 'RAIL', at: 'E8', dir: 'down' } },
    { who: 'tobi', action: 'play', input: { post: '$game', word: 'HALL', at: 'B11', dir: 'across' } },
    { who: 'mara', action: 'play', input: { post: '$game', word: 'JOKE', at: 'H4', dir: 'across' } },
    { who: 'jonas', action: 'play', input: { post: '$game', word: 'QUEEN', at: 'K1', dir: 'down' } },
    { who: 'aylin', action: 'play', input: { post: '$game', word: 'VICE', at: 'D3', dir: 'down' } },
    { who: 'tobi', action: 'swap', input: { post: '$game' } },
    { who: 'mara', action: 'play', input: { post: '$game', word: 'TRIM', at: 'B4', dir: 'across' } },
    { who: 'jonas', action: 'play', input: { post: '$game', word: 'SHOT', at: 'B1', dir: 'down' } },
    { who: 'aylin', action: 'play', input: { post: '$game', word: 'SAFE', at: 'B1', dir: 'across' } },
    { who: 'tobi', action: 'play', input: { post: '$game', word: 'KING', at: 'J4', dir: 'down' } },
    { who: 'mara', action: 'play', input: { post: '$game', word: 'BASE', at: 'H8', dir: 'across' } },
    { who: 'jonas', action: 'play', input: { post: '$game', word: 'MET', at: 'G9', dir: 'across' } },
    { who: 'aylin', action: 'play', input: { post: '$game', word: 'TWO', at: 'I2', dir: 'down' } },
    { who: 'tobi', action: 'play', input: { post: '$game', word: 'BEED', at: 'H8', dir: 'down' } },
    { who: 'jonas', action: 'doubt', input: { post: '$game' } },
    { who: 'mara', action: 'doubt', input: { post: '$game' } },
    { who: 'mara', action: 'play', input: { post: '$game', word: 'EDIT', at: 'F2', dir: 'across', via: 'claude' } },
    { who: 'jonas', action: 'play', input: { post: '$game', word: 'PRO', at: 'A9', dir: 'across' } },
    { who: 'aylin', action: 'play', input: { post: '$game', word: 'BED', at: 'H8', dir: 'down' } },
    { who: 'tobi', action: 'play', input: { post: '$game', word: 'SPUN', at: 'H11', dir: 'across' } },
  ],
};

// A short earlier game of two that ended with both passing: so that the board has more than one game to choose from.
export const EARLIER = {
  title: 'Lunch break',
  seed: 'lunch-break-3',
  players: ['tobi', 'aylin'],
  steps: [
    { who: 'tobi', action: 'new', input: { title: 'Lunch break', seed: 'lunch-break-3' } },
    { who: 'aylin', action: 'join', input: { post: '$game' } },
    { who: 'tobi', action: 'play', input: { post: '$game', word: 'DOING', at: 'E6', dir: 'across' } },
    { who: 'aylin', action: 'play', input: { post: '$game', word: 'OPT', at: 'I7', dir: 'across' } },
    { who: 'tobi', action: 'play', input: { post: '$game', word: 'WIN', at: 'G5', dir: 'down' } },
    { who: 'aylin', action: 'play', input: { post: '$game', word: 'ARMS', at: 'D8', dir: 'across' } },
    { who: 'tobi', action: 'pass', input: { post: '$game' } },
    { who: 'aylin', action: 'pass', input: { post: '$game' } },
  ],
};
