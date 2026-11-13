# Word Tiles: a Weave client service for a word game among friends

A board shown its own way. A project's maintainers pin this service to a board; every member's own Weave then fetches it and shows the board through it. A game is a post; two to four friends lay letter tiles on a board of 11 × 11 squares so that they form words that cross the words already there; every move is an event signed by who made it, and every tile on the board has the color of who laid it. It's built into a WebAssembly component that Weave runs itself, with no key, no network and no files: it only turns the board's events into a state, and an action into events for the member to sign.

```
npm install
npm run build              # → site/rules.js and board.wasm
tar -czf word-tiles.tar.gz board.wasm site
```

## The rules

**A game is a post.** Its title names it; its text carries the seed word of its bag (`Bag: plum-river-17`). Whoever made it is its first player; up to three more join it; the turns go round in that order. It begins with the first move: after that nobody joins.

**The board** is 11 × 11: columns A to K, rows 1 to 11, so a square is `F6`. The first word goes through the middle, F6. Some squares are worth more to a tile laid on them, marked quietly:

```
     A B C D E F G H I J K          ∴  the letter counts three times (8)
  1  ∴ . . · . . . · . . ∴          ·  the letter counts double (16)
  2  . . . . ○ . ○ . . . .          ○  the word counts double (8)
  3  . . . . . · . . . . .          ◇  the middle: nothing extra
  4  · . . ∴ . . . ∴ . . ·
  5  . ○ . . · . · . . ○ .
  6  . . · . . ◇ . . · . .
  7  . ○ . . · . · . . ○ .
  8  · . . ∴ . . . ∴ . . ·
  9  . . . . . · . . . . .
 10  . . . . ○ . ○ . . . .
 11  ∴ . . · . . . · . . ∴
```

**One rack, open to all.** Seven tiles lie face up for everyone. Whoever's turn it is lays one to seven of them in one row or column; then the rack is filled up from the bag. Nobody has tiles of their own, because a lens cannot hide anything: everything on a board can be read by all its members. The fun is in what you leave for the next one.

**The bag** has 64 tiles and no blank ones:

| counts | letters |
| --- | --- |
| 1 point | A ×6, E ×7, I ×4, O ×5 |
| 2 | L ×3, N ×4, R ×4, S ×3, T ×4, U ×2 |
| 3 | D ×2, H ×2 |
| 4 | C ×2, G ×2, M ×2, P ×2 |
| 5 | B, F, W, Y |
| 6 | K, V |
| 7, 9, 11, 12 | X, J, Z, Q |

Its order comes out the same for everyone: the tiles are shuffled by a small generator of the lens's own from the game's seed word (`bagFor` in `src/board.js`). The view makes up a random seed word when a game is started; an agent passes one. Nothing about it is secret: whoever reads the code and the post can work out which tiles come next. That is fine among friends, and not for tournaments.

**A move** is a word: its tiles go in one row or one column without gaps, and (except for the first word) it touches what lies there. It counts the letters' values of every word it makes or extends: the word itself and every word a laid tile forms across it. A bonus square counts only under a tile laid in this move. Laying all seven tiles counts 30 on top.

**Is that a word?** There is no dictionary (no network, nothing to look it up in). A word stands unless the others doubt it, as at a kitchen table:

- Only the last move can be doubted, only if it is a word (not a pass or a swap), and only until the next move is made. Making the next move means accepting it.
- Each other player can doubt it once. It is taken back as soon as more than half of the other players doubt it: one of one, two of two, two of three.
- Taken back means: its tiles return to the rack, the tiles drawn after it return to the top of the bag in their order, its points are gone. The turn stays where it is: it had passed on already.
- A doubt about an earlier move, a second doubt by the same player, a doubt by its own player or by someone who doesn't play changes nothing.
- The last move of a game can still be doubted after the game is over (no next move accepts it); if it is taken back, the game goes on.

**Instead of a word:** pass; or swap the whole rack for seven new tiles from the top of the bag (the old ones go to its bottom, in their order), while the bag has at least seven.

**The end:** someone has laid the last tile (the bag is empty and so is the rack), or everyone has passed in turn: as many passes in a row as there are players (a swap or a word in between, even one that is taken back, begins the row anew). Whoever has the most points wins; with the same points, they share it.

64 tiles, not the 80 or more of the big games: on 11 × 11 squares more would not fit. (Games played alone by a solver put a median of 65 tiles of a bag of 82 on the board and never all of them.)

## What one sees

Made for the room a board has in Weave's window (about 540 × 480). From the top:

- **A line**: the game's name (a double-click opens its post in Weave), how many tiles are in the bag, and "Games": all games on the board, the latest first, to pick one, to join one that waits, and to start a new one. The latest game that is not over is shown first.
- **The board**, large and square: slate with a recess for every square. A tile is glazed in the color of who laid it, so the board is a picture of the game played together; its letter is large, what it counts small in the corner. The last move's tiles have a bright edge.
- **Beside it** (under it on a phone): the players with their points, whose turn it is; then what there is to do ("Your turn", or what the tiles you laid would count: every word and the sum, or why it is not a move yet); the last move ("+18 · Tobi · GARDEN", "Doubt it" for the others, who doubts it so far); all moves, the latest first.
- **Under it**: the rack, open to all (dimmed while it is someone else's turn), a button that takes your tiles back, one that shuffles the rack (only for you), and "Play".

By hand: drag a tile from the rack to a square (or click the tile, then the square); drag it on, or back; a click on a tile lying tentatively takes it back. While tiles lie there, the view shows the words they would form, the points, and whether it is a legal move, by the same rules `fold` judges by (`site/rules.js` is made from `src/board.js`). "Play" sends it.

Motion: tiles land one after another with a small clack, the word lifts for a moment, the points count up; a friend's move comes over from the rack and says who laid it; a word that is doubted trembles, and when it is taken back its tiles shake and fly back to the rack; the winner gets a small burst.

Wider than 900 the board grows and the column beside it gets more room; narrower than 430 it's a phone. People are chips with their initials in a color made from their name (moved on where two players' colors would be too close); the frame gets no pictures.

## How it fits together

- `src/board.js` is the logic. Weave calls it (`wit/service.wit`, the `board` world): `fold(board, items)` gets the board (`{name, title}`) and its events, oldest first, and returns the state as JSON; `act(name, input, state, me)` says what an action means: events for the member to sign, as JSON `[{kind, body}]`, or a thrown string that says why not. Both are pure, with no clock and no chance: the seed word of a new game is the caller's to make.
- `site/` is the view: plain HTML, CSS and JavaScript in a sandboxed frame in Weave (no network, no forms). It talks only to Weave, by `postMessage`: it gets `{weave: 'view', state, actions, board, me}` whenever the board changes, asks with `{weave: 'act', id, name, input}`, hears `{weave: 'acted', id, error?}`, and opens a post with `{weave: 'open', post}`. `site/rules.js` is not written by hand: `npm run build` copies the rules (the board's layout, the letters, the referee) out of `src/board.js` into it.
- `weave.app.json` is its contract: `client.writes` are the kinds its actions may propose: `weave.post`, `tiles.join`, `tiles.move`, `tiles.doubt`. Weave checks every proposed event against it, and that it's about this board, before the member signs it with their own rights.

## fold is the referee

What `fold` gets: the board's posts, their edits and deletions, the messages in their chats, and the events of this lens's own three kinds, each about a game's post (`target`):

| kind | body | counts if |
| --- | --- | --- |
| `tiles.join` | `{target}` | the game has not begun, has fewer than four players, and its author is not in it yet |
| `tiles.move` | `{target, n, move: 'play', word, at, dir, via?}` | `n` is the game's next move number (1 for the first), its author is the player whose turn that is, the game is not over, and the word is a legal move: letters A to Z, on the board, a free square before and after it, every letter either lying there already or on the rack, at least one tile laid, through F6 if the board is empty, else touching what lies there |
| | `{target, n, move: 'pass', via?}` | as above |
| | `{target, n, move: 'swap', via?}` | as above, and the bag has at least seven tiles |
| `tiles.doubt` | `{target, n, via?}` | `n` is the number of the last move made, that move is a word still lying there, and its author is another player who has not doubted it yet |

Everything else counts for nothing, for good: `fold` never refuses and never throws, it leaves out. Which tiles a word lays follows from the board: its letters that lie there already stay, the others come from the rack. The move number makes the order explicit: a move or a doubt whose number is ahead of the game waits until the game gets there, so a move signed by a computer whose clock runs a little behind still counts (Weave hands the events over by their signed time). For the same reason the posts are read first: a join signed "before" its game's post counts. A post's deletion by its author takes the game away; an edit can rename it, but the bag stays as the post first said it. A post made in Weave's own list, without `Bag:` in its text, is a game too: its bag is shuffled from its title.

`fold` cannot tell that an agent signed: the author is the person. `via` is what the event says of itself.

## The state

`fold` returns `{board, games, rules, actions}`. A game:

| | |
| --- | --- |
| `id`, `title`, `by`, `author`, `time`, `seed` | the post: its id, name, who made it (name and id), when, and its seed word |
| `players` | in their order: `{did, name, score}` |
| `begun`, `over`, `winners?` | whether a move has been made; whether it is over, and then who won (ids) |
| `turn?`, `n` | whose turn it is (an id; none while it waits for a second player, or is over), and the number the next move will have |
| `rows` | the board as eleven lines of eleven letters, `.` where nothing lies: `rows[5][5]` is F6 |
| `tiles` | who laid what: `{at, letter, by, n}` (`n`: the move) |
| `rack`, `bag` | the letters on the rack, and how many tiles the bag holds (not which: that is for the code to say) |
| `open?`, `doubts?` | the number of the last move while it is a word that can be doubted, and how many doubts take it back |
| `moves` | all turns: `{n, by, name, time, move, via?}`; a word also has `word, at, dir, tiles: [{at, letter}], words: [{word, points}], points, all?, doubts: [{by, name, time, via?}], taken?` |
| `chats` | how many messages its post's chat has |

`rules` says what the view and an agent need to know: `{size, middle, rack, allSeven, letters: {A: {tiles, value}, …}, squares: {dw: […], tl: […], dl: […]}}`.

## What one can do, by hand or as an agent

| action | input | proposes |
| --- | --- | --- |
| `new` | `{title, seed}` | `weave.post` `{title, text: '… Bag: <seed>'}`: a game, with you as its first player |
| `join` | `{post?}` | `tiles.join` `{target}` |
| `play` | `{post?, word, at, dir, via?}` | `tiles.move` `{target, n, move: 'play', word, at, dir}` |
| `pass` | `{post?, via?}` | `tiles.move` `{target, n, move: 'pass'}` |
| `swap` | `{post?, via?}` | `tiles.move` `{target, n, move: 'swap'}` |
| `doubt` | `{post?, via?}` | `tiles.doubt` `{target, n}`: about the last move |

`post` is the game's post id; left out, it is the latest game that is not over. `title`: at most 80 characters. `seed`: 3 to 32 lowercase letters, digits or hyphens, a new one for every game. `word` is the whole word as it will read on the board, including the letters that lie there already (`GARDEN`, not just the letters you add); `at` is the square of its first letter (`D6`); `dir` is `across` or `down`. A word that only adds one tile to a word across it is still given as a word of two letters or more, in the direction it reads. `via` is an agent's own name in one lowercase word.

`act` refuses with a reason one can read: "it is Tobi's turn", "there is no K on the rack", "on G6 lies an E, not an A", "a tile lies right before D6: say the whole word", "a word must touch one that lies on the board", "the first word goes through the middle square, F6", "GARDEN does not fit on the board from H6 across", "you doubt GOED already", "this game has begun: nobody joins it any more".

An agent plays through the same actions, signed as the agent for its person. A move made by a person's agent is the person's move; it says "via claude" only if the agent passes `via`.

```
weave board view games -p <project>                 # the state: games[].rows, rack, turn, n, moves
weave board act games new   -p <project> --as claude --input '{"title": "Friday round", "seed": "plum-river-17"}'
weave board act games join  -p <project> --as claude --input '{"post": "<id>"}'             # <id>: the game's post
weave board act games play  -p <project> --as claude --input '{"post": "<id>", "word": "GARDEN", "at": "D6", "dir": "across", "via": "claude"}'
weave board act games pass  -p <project> --as claude --input '{"post": "<id>", "via": "claude"}'
weave board act games swap  -p <project> --as claude --input '{"post": "<id>", "via": "claude"}'
weave board act games doubt -p <project> --as claude --input '{"post": "<id>", "via": "claude"}'
```

An agent signs only the kinds its person allowed it. `weave.post` (to start a game) it may sign by default; to join, to move and to doubt, its person has to allow it the lens's own kinds: `tiles.join`, `tiles.move`, `tiles.doubt`.

## Looking at it without Weave

`preview/` is not part of the lens (it isn't released): a page that shows `site/` in a frame of the board's size and plays Weave's part with the real `fold` and `act`, and what an action proposes is checked against `weave.app.json`. You are Mara.

```
node preview/serve.js      # → http://127.0.0.1:8844/preview/
node preview/shoot.js      # photographs into preview/out/ (needs ../tools/cdp.js and Chrome)
```

`?play=1` plays the last part of the sample game by itself; `?at=12` shows it after its first 12 steps, `?end=1` at its end, `?fresh=1` just made, `?empty=1` a board without a game; `?me=tobi` looks as someone else; `?w=1050&h=900` another size; `?theme=light`.

### The sample game, to replay anywhere

`preview/sample.js` exports a whole game: `GAME = {title, seed, players, scene, steps}`. `steps` is the list of everything that happens, each `{who, action, input}` exactly as `act` takes it; `'$game'` in an input stands for the game's post, the id of the post that the first step (`new`) makes. Nothing else depends on that id. To replay it in a real Weave: let Mara do step 0, take the new post's id, put it in for `$game`, and let each step's person (or their agent) do `weave board act <board> <action> --input '<input>'` in the list's order. The game is valid under the rules above with the bag its seed word gives (`tmp/write-sample.mjs` replays it through `fold` and `act`, and checks that it comes out the same with another post id). It has one swap, one word that is none (two of the others doubt it and it is taken back), one move by Mara's agent (`via: 'claude'`) and ends with the last tile laid. `scene` is the index of the step where its last part begins, which `?play=1` plays.

`tmp/` holds how it was found (not part of the lens either, and not kept in git): `words.mjs`, a list of 1,700 plain everyday words written down for it; `solve.mjs` with `engine.mjs`, which plays games alone on the lens's own referee and bag until one ends with the last tile, and lets the four take its turns; `write-sample.mjs`, which writes `preview/sample.js` and checks it. And the checks: `referee.mjs` (what must count for nothing), `compare.mjs` (the built component against the source: `npx jco transpile board.wasm -o tmp/built` first), `hands.mjs` (the sandboxed view used with a real pointer and keyboard), `frames.mjs` (`?play=1` watched), `fill.mjs` (how many tiles fit on the board).

## Releasing it and showing a board with it

Release the archive (`weave app release v1.0 --asset wasm=word-tiles.tar.gz -p <project>`), then a maintainer pins it to a board:

```
weave board lens games -p <project> --artifact <project>            # suggested: each member chooses
weave board lens games -p <project> --artifact <project> --require  # every member's Weave shows it
```
