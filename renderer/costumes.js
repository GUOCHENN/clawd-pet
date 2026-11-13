/* global gsap, svgs, moveWindow, clampX, rand, sfx, petEl */
// Costume actions modelled on Anthropic's Clawd illustrations (headphones, chef, cowboy, ...),
// drawn big and played big. Every accessory is pixel art written as an ASCII grid (or generated,
// for rings) and drawn as <rect>s onto the walk rig, so it moves with the body. Loaded before
// pet.js, which merges costumeActions into its action list and calls buildCostumes().
//
// Grid: Clawd is 12x8 "big" pixels (C = 10.625 SVG units; body = columns 2-9, from x = 11).
// Accessories use the art-pixel grid M = C / 3 (one pixel on screen). Sprite positions are in
// those cells (mx, my), measured from the body's top-left corner: the body spans mx 0-23 and
// my 0-17, the arms mx -6..-1 / 24..29 at my 6-11, the eyes mx 3-5 / 18-20 at my 3-5, and the
// ground is at my 24.

const C = 10.625;
const M = C / 3;
const BODY_X = 11;

const PAL = {
  K: '#1d1d1f', W: '#ffffff', l: '#cfd6da', G: '#9aa0a6', g: '#5f6368',
  B: '#2b5797', b: '#bfe3f2', Y: '#f4c542', O: '#d9962b', N: '#5c3a1e', n: '#7d5230',
  T: '#c9974f', P: '#4b4aa8', V: '#2f2d72', R: '#d94c3d', M: '#5a1f2f',
  I: '#3b3f9e', C: '#DD775B', F: '#ffe9a8', E: '#6fcf97', D: '#2a2d3a',
};

// ---- small generators for round shapes ----
// An ellipse ring w x h cells, `thick` cells wide, in colour ch (inside left transparent).
function ringRows(w, h, thick, ch) {
  const rows = [];
  for (let y = 0; y < h; y++) {
    let row = '';
    for (let x = 0; x < w; x++) {
      const dx = (x + 0.5 - w / 2);
      const dy = (y + 0.5 - h / 2);
      const outer = (dx / (w / 2)) ** 2 + (dy / (h / 2)) ** 2 <= 1;
      const inner = (dx / (w / 2 - thick)) ** 2 + (dy / (h / 2 - thick)) ** 2 <= 1;
      row += outer && !inner ? ch : '.';
    }
    rows.push(row);
  }
  return rows;
}
const pad = (rows, w) => rows.map((r) => r.padEnd(w, '.'));
const mirror = (rows) => rows.map((r) => r.split('').reverse().join(''));
// Left half -> full row, mirrored about the centre (keeps hats and headphones symmetric).
const sym = (halves) => halves.map((h) => h + h.split('').reverse().join(''));
const times = (n, row) => Array(n).fill(row);

// magnifying glass: a thick ring with a glint, and a long handle off the bottom right
const LENS_ROWS = (() => {
  const ring = ringRows(15, 15, 2, 'I');
  ring[3] = ring[3].slice(0, 4) + 'bb' + ring[3].slice(6);
  ring[4] = ring[4].slice(0, 3) + 'b' + ring[4].slice(4);
  const rows = pad(ring, 24);
  for (let i = 0; i < 9; i++) {
    const x = 12 + i;
    rows.push('.'.repeat(x) + 'NN' + '.'.repeat(Math.max(0, 22 - x)));
  }
  rows[13] = rows[13].slice(0, 12) + 'II' + rows[13].slice(14);
  return rows;
})();

// parent: 'body' moves with the torso, 'group' with the whole character, 'behind' like group
// but drawn behind the body (so things can slide out from behind Clawd).
const SPRITES = {
  // chunky cups, thick stepped band high above the head (ref: headphones)
  headphones: { parent: 'body', mx: -6, my: -10, rows: sym([
    '...........BBBBBBB', '........BBBBBBBBBB', '.....BBBB.........', '....BBB...........',
    '...BBB............', '..BBB.............', '..BB..............', '.BBBBB............',
    ...times(4, 'BbBBBBB...........'), ...times(3, 'BBBBBBB...........'), '.BBBBB............',
  ]) },
  // light headset with a microphone boom (typing)
  headset: { parent: 'body', mx: -6, my: -10, rows: [
    ...sym([
      '...........lllllll', '........llllllllll', '.....llll.........', '....lll...........',
      '...lll............', '..lll.............', '..ll..............', '.lllll............',
      ...times(4, 'lGlllll...........'), ...times(3, 'lllllll...........'), '.lllll............',
    ]),
    '.......ll...........................',
    '........ll..........................',
    '.........lllK.......................',
  ] },
  // ---- typing station, beside Clawd on the right; pulled out from behind it ----
  desk: { parent: 'behind', mx: 31, my: 11, rows: [
    'NNNNNNNNNNNNNNNNNNNNNNNN',
    'nnnnnnnnnnnnnnnnnnnnnnnn',
    ...Array(11).fill('.NN..................NN.'),
  ] },
  monitor: { parent: 'behind', mx: 35, my: -5, rows: [
    'gggggggggggggggggg',
    ...Array(11).fill('gDDDDDDDDDDDDDDDDg'),
    'gggggggggggggggggg',
    '.......gggg.......',
    '.......gggg.......',
    '.....gggggggg.....',
  ] },
  keyboard: { parent: 'behind', mx: 32, my: 9, rows: [
    'gWgWgWgWgWgWgWgWgWgWgg',
    'gggggggggggggggggggggg',
  ] },
  // big maroon deck with kicked-up tails and yellow wheels (ref: skateboard)
  skateboard: { parent: 'group', mx: -8, my: 24, rows: [
    'M......................................M',
    'MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM',
    '.MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM.',
    '.....gggg......................gggg.....',
    '....YOOY........................YOOY....',
    '....YYYY........................YYYY....',
  ] },
  // ---- detective ----
  detHat: { parent: 'body', mx: -5, my: -11, rows: sym([
    '.........KKKKKKK.', ...times(4, '........KKKKKKKKK'), ...times(2, '........NNNNNNNNN'),
    'KKKKKKKKKKKKKKKKK', '.KKKKKKKKKKKKKKKK',
  ]) },
  // one eye squinting, the other blown up behind the lens
  detEyes: { parent: 'body', mx: 3, my: 1, rows: [
    '...............KKKKKK',
    '...............KKKKKK',
    '...............KKKKKK',
    'KKK............KKKKKK',
    '...............KKKKKK',
    '...............KKKKKK',
  ] },
  lens: { parent: 'body', mx: 13, my: -4, rows: LENS_ROWS },
  exclaim: { parent: 'body', mx: 10, my: -20, rows: ['RRR', 'RRR', 'RRR', 'RRR', 'RRR', 'RRR', '...', 'RRR', 'RRR'] },
  // ---- builder ----
  hardhat: { parent: 'body', mx: -5, my: -11, rows: sym([
    '...........OOOOOO', '.........OOYYYYOY', '........OYYYYYOYY', '.......OYYYYYYOYO',
    '.......OYYYYYYOOO', '.......OYYYYYYOYO', '.......OYYYYYYOYY', '.......OYYYYYYOYY',
    'OOOOOOOOOOOOOOOOO', '.YYYYYYYYYYYYYYYY',
  ]) },
  // a sledgehammer taller than Clawd, gripped in the right hand
  hammer: { parent: 'body', mx: 20, my: -17, rows: [
    '.gggggggggggggg.',
    'gGGGGGGGGGGGGGGg',
    'gGllGGGGGGGGGGGg',
    'gGllGGGGGGGGGGGg',
    'gGGGGGGGGGGGGGGg',
    'gGGGGGGGGGGGGGGg',
    'gGGGGGGGGGGGGGGg',
    '.gggggggggggggg.',
    ...Array(15).fill('......NNN.......'),
    '......KKK.......',
    '......KKK.......',
    '......KKK.......',
  ] },
  spark: { parent: 'body', mx: 43, my: 13, rows: [
    '...F...F...', '....F.F....', 'F...WWW...F', '.F.WWWWW.F.', '..WWWWWWW..', '.F.WWWWW.F.', 'F...WWW...F', '....F.F....', '...F...F...',
  ] },
  // ---- chef ----
  chefHat: { parent: 'body', mx: -2, my: -20, rows: sym([
    '..........WWWW', '......WWWWWWWW', '...WWWWWWWlWWW', '.WWWWWWWWlWWWW', 'WWWWWWWWWWWWWW',
    'WWWWWWlWWWWWWW', 'WWWWWWWWWWWWWW', 'WWWWWWWWWWWWWW', '.WWWWWWWWWWWWW', '..WWWWWWWWWWWW',
    ...times(4, '...WWWWWWWWWWW'), '...lllllllllll', ...times(6, '...WWWWWWWWWWW'),
  ]) },
  // big frying pan held out in the left hand
  pan: { parent: 'body', mx: -27, my: 5, rows: [
    '.gggggggggggggg..........',
    'ggGGGGGGGGGGGGgg.........',
    'gggggggggggggggggNNNNNNNN',
    '.gggggggggggggg..NNNNNNNN',
  ] },
  pancake: { parent: 'body', mx: -25, my: 1, rows: ['...OOOOOOOO...', '.OOYYYYYYYYOO.', 'OYYYYYYYYYYYYO', '.OOOOOOOOOOOO.'] },
  // ---- cowboy ----
  cowboyHat: { parent: 'body', mx: -12, my: -14, rows: sym([
    '................NNNNNNN.', '...............NNNNNNNNN', '...............NNNNnnnnn', '..............NNNNNNNNNN',
    '..............NNNnnnnnnn', '..............NNNNNNNNNN', '..............KKKKKKKKKK', '..............KKKKKKKKKK',
    'NNN...........NNNNNNNNNN', 'NNNN........NNNNNNNNNNNN', 'NNNNNNNNNNNNNNNNNNNNNNNN', '.nnnnnnnnnnnnnnnnnnnnnnn',
    '...NNNNNNNNNNNNNNNNNNNNN',
  ]) },
  rope: { parent: 'body', mx: 27, my: -14, rows: Array(20).fill('TT') },
  lasso: { parent: 'body', mx: 12, my: -27, rows: ringRows(34, 14, 2, 'T') },
  // ---- wizard ----
  wizHat: { parent: 'body', mx: -6, my: -24, rows: [
    'YY.......................................',
    'YYY......................................',
    '.PPP.....................................',
    '..PPPP...................................',
    '...PPPPP.................................',
    '.....PPPPP...............................',
    '.......PPPPPW............................',
    '.........PPPPPP..........................',
    '..........PPPWPPP........................',
    '..........PPPPPPPPP......................',
    '.........PPPPPPPPPPW.....................',
    '........PPWPPPPPPPPPPP...................',
    '........PPPPPPPPWPPPPPPP.................',
    '.......PPPPPPPPPPPPPPPPPPP...............',
    '.......PPPPWPPPPPPPPPPWPPPP..............',
    '......PPPPPPPPPPPPPPPPPPPPPP.............',
    '......PPPPPPPPPWPPPPPPPPPPPPP............',
    '.....PPPWPPPPPPPPPPPPPPPWPPPPP...........',
    '.....VVVVVVVVVVVVVVVVVVVVVVVVV...........',
    '.....VVVVVVVVVVVVVVVVVVVVVVVVV...........',
    'PPPPPPPPWPPPPPPPPPWPPPPPPPPPWPPPPP.......',
    '.PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP........',
  ] },
  // a long wand with a big star at the tip
  wand: { parent: 'body', mx: 27, my: 0, rows: [
    '.................Y...',
    '................YYY..',
    '..............YYYWYYY',
    '...............YYYYY.',
    '..............KKYYYY.',
    '............KK.Y...Y.',
    '..........KK.........',
    '........KK...........',
    '......KK.............',
    '....KK...............',
    '..KK.................',
    'KK...................',
  ] },
  // ---- astronaut ----
  helmet: { parent: 'body', mx: -4, my: -14, rows: (() => {
    const rows = sym([
      '...............R', '..............RR', '...............R', ...times(3, '...............l'),
      '...........WWWWW', '........WWW.....', '......WW........', '.....W..........', '....W...........',
      '...W............', ...times(12, '..W.............'), ...times(2, '.lllllllllllllll'),
    ]);
    rows[9] = rows[9].slice(0, 24) + 'bb' + rows[9].slice(26); // glare
    rows[10] = rows[10].slice(0, 25) + 'bb' + rows[10].slice(27);
    return rows;
  })() },
  antennaLight: { parent: 'body', mx: 10, my: -14, rows: ['.F.', 'FWF', '.F.'] },
  // ---- party: a tall fizzing fuse ----
  fuse: { parent: 'body', mx: 14, my: -9, rows: [
    '.CC.', 'CCC.', '.CCC', '..CC', '.CC.', 'CC..', 'CCC.', '.CCC', '.CCC',
  ] },
  // ---- cool: huge pixel shades right across the face ----
  glasses: { parent: 'body', mx: -2, my: 1, rows: [
    'KKKKKKKKKKKKKKKKKKKKKKKKKKKK',
    'KKKKKKKKKKKKKKKKKKKKKKKKKKKK',
    '.KKWWKKKKKK......KKWWKKKKKK.',
    '.KWWKKKKKKK......KWWKKKKKKK.',
    '.KWKKKKKKKK......KWKKKKKKKK.',
    '..KKKKKKKK........KKKKKKKK..',
    '...KKKKKK..........KKKKKK...',
  ] },
  happyEyes: { parent: 'body', mx: 2, my: 3, rows: [
    '.KKK...........KKK.',
    'K...K.........K...K',
  ] },
};

// lines of "code" that appear on the monitor, and a blinking cursor
const CODE_LINES = [
  [37, -3, 'YYYYY.bbbbbbb'],
  [38, -1, 'bbbbbb.CCCC'],
  [38, 1, 'FFFF.YYYYYYY'],
  [37, 3, 'EEEEEEE.bbbb'],
];
const NOTE_ROWS = ['..KKKK', '..K..K', '..K..K', '..K...', 'KKK...', 'KKK...', 'KK....'];
const SPARKLE_ROWS = ['..F..', '.FWF.', 'FWWWF', '.FWF.', '..F..'];

function pixelSprite(parent, { mx, my, rows, cell = M }) {
  const NS = 'http://www.w3.org/2000/svg';
  const g = document.createElementNS(NS, 'g');
  const x0 = BODY_X + mx * M;
  const y0 = my * M;
  rows.forEach((row, ry) => {
    for (let cx = 0; cx < row.length;) {
      const ch = row[cx];
      if (!PAL[ch]) { cx++; continue; }
      let len = 1;
      while (row[cx + len] === ch) len++;
      const r = document.createElementNS(NS, 'rect');
      r.setAttribute('x', x0 + cx * cell);
      r.setAttribute('y', y0 + ry * cell);
      r.setAttribute('width', len * cell + 0.4);
      r.setAttribute('height', cell + 0.4);
      r.setAttribute('fill', PAL[ch]);
      g.appendChild(r);
      cx += len;
    }
  });
  g.setAttribute('opacity', 0);
  parent.appendChild(g);
  return g;
}

// Centre of a fine cell in SVG units, for svgOrigin values.
const at = (mx, my) => `${BODY_X + mx * M} ${my * M}`;

function buildCostumes() {
  const r = svgs.walk.rig;
  const parents = { body: r.body, group: r.group, behind: r.group };
  const c = {};
  for (const [name, def] of Object.entries(SPRITES)) {
    c[name] = pixelSprite(parents[def.parent], def);
    if (def.parent === 'behind') r.group.insertBefore(c[name], r.body);
  }
  c.code = CODE_LINES.map(([mx, my, row]) => {
    const g = pixelSprite(r.group, { mx, my, rows: [row] });
    r.group.insertBefore(g, r.body);
    return g;
  });
  c.cursor = pixelSprite(r.group, { mx: 37, my: 5, rows: ['WW'] });
  r.group.insertBefore(c.cursor, r.body);
  c.notes = [[27, -8], [-9, -10], [30, -2], [-12, -3]].map(([mx, my]) => pixelSprite(r.group, { mx, my, rows: NOTE_ROWS }));
  c.sparkles = Array.from({ length: 9 }, () => pixelSprite(r.body, { mx: 45, my: 3, rows: SPARKLE_ROWS }));
  r.costume = c;
  r.costumeParts = [...Object.values(c)].flat();
}

// Helpers shared by the costume timelines.
const wear = (tl, parts, at0 = 0) => tl.set(parts, { attr: { opacity: 1 } }, at0);
// Accessories arrive with a drop-and-bounce and leave with a hop off the top.
const popOn = (tl, parts, t = 0) => wear(tl, parts, t).fromTo(parts, { y: -40 }, { y: 0, duration: 0.3, ease: 'bounce.out' }, t);
const takeOff = (tl, parts, t) => tl.to(parts, { y: '-=24', attr: { opacity: 0 }, duration: 0.3, ease: 'back.in(2)' }, t);
const swapEyes = (tl, r, eyes, t = 0) => tl.set(r.eyes, { opacity: 0 }, t).set(eyes, { attr: { opacity: 1 } }, t);
// Sparkles fly out from (dx, dy) relative to their home spot at the wand tip.
function burst(tl, sparkles, t, { dx = 0, dy = 0, spread = 40, arc = [0, Math.PI * 2] } = {}) {
  sparkles.forEach((s, i) => {
    const a = arc[0] + ((i + 0.5) / sparkles.length) * (arc[1] - arc[0]) + rand(-0.2, 0.2);
    tl.fromTo(s, { x: dx, y: dy, attr: { opacity: 1 } }, {
      x: dx + Math.cos(a) * spread, y: dy + Math.sin(a) * spread, attr: { opacity: 0 }, duration: 0.7, ease: 'power2.out',
    }, t);
  });
}
// The whole window shakes (big impacts).
const shake = (tl, t, power = 6) => tl.to(petEl, { keyframes: { x: [power, -power, power * 0.6, -power * 0.6, 0] }, duration: 0.2 }, t);

const costumeActions = {
  music: {
    label: '听歌', group: 'costume', weight: 0.6, svg: 'walk',
    run() {
      const r = svgs.walk.rig;
      const c = r.costume;
      const tl = gsap.timeline();
      popOn(tl, c.headphones);
      swapEyes(tl, r, c.happyEyes);
      tl.call(sfx.melody, [4.2], 0.2);
      for (let i = 0; i < 10; i++) {
        const t = 0.3 + i * 0.4;
        const side = i % 2 ? 1 : -1;
        tl.to(r.body, { y: 10, rotation: 10 * side, scaleY: 0.84, scaleX: 1.08, svgOrigin: '53 65', duration: 0.2, ease: 'power2.out' }, t)
          .to(r.body, { y: -6, rotation: 0, scaleY: 1.12, scaleX: 0.94, duration: 0.2, ease: 'power2.in' }, t + 0.2)
          .to(r.hands, { y: (h) => ((h === 0) === (side > 0) ? -18 : 6), duration: 0.2 }, t)
          .to(r.group, { y: i % 4 === 3 ? -24 : 0, duration: 0.2, yoyo: i % 4 === 3, repeat: i % 4 === 3 ? 1 : 0 }, t);
      }
      c.notes.forEach((n, i) => {
        const side = i % 2 ? -1 : 1;
        tl.fromTo(n, { x: 0, y: 0, attr: { opacity: 0 } }, {
          keyframes: [{ attr: { opacity: 1 }, x: 10 * side, y: -18, duration: 0.4 }, { attr: { opacity: 0 }, x: 26 * side, y: -60, duration: 0.9 }],
          ease: 'none', repeat: 2, repeatDelay: 0.1,
        }, 0.3 + i * 0.35);
      });
      tl.to([r.body, r.hands, r.group], { y: 0, rotation: 0, scaleY: 1, scaleX: 1, duration: 0.2 }, 4.4);
      takeOff(tl, c.headphones, 4.5);
      return tl;
    },
  },

  // Side typing: pull a desk, monitor and keyboard out from behind, type, then put it all away.
  typing: {
    label: '敲代码', group: 'costume', weight: 0.6, svg: 'walk',
    run() {
      const r = svgs.walk.rig;
      const c = r.costume;
      const hand = r.hands[1];
      const tl = gsap.timeline();
      const grow = { scaleY: 0, transformOrigin: '50% 100%' };

      // --- take it out ---
      popOn(tl, c.headset);
      tl.call(sfx.flip, [], 0.25)
        .set(c.desk, { attr: { opacity: 1 } }, 0.25)
        .fromTo(c.desk, grow, { scaleY: 1, duration: 0.25, ease: 'steps(4)' }, 0.25)
        .call(sfx.blip, [], 0.55)
        .set(c.monitor, { attr: { opacity: 1 } }, 0.55)
        .fromTo(c.monitor, grow, { scaleY: 1, duration: 0.25, ease: 'steps(4)' }, 0.55)
        // reach behind, then pull the keyboard out from behind Clawd onto the desk
        .to(hand, { x: -4 * M, y: 2 * M, duration: 0.15 }, 0.85)
        .to(r.body, { rotation: -6, svgOrigin: '53 65', duration: 0.15 }, 0.85)
        .call(sfx.whoosh, [], 1.0)
        .set(c.keyboard, { attr: { opacity: 1 } }, 1.0)
        .fromTo(c.keyboard, { x: -28 * M }, { x: 0, duration: 0.35, ease: 'back.out(1.6)' }, 1.0)
        .to(hand, { x: 5 * M, y: 2 * M, duration: 0.3, ease: 'power2.out' }, 1.0)
        // turn to the keyboard
        .to(r.body, { rotation: 7, y: 2, duration: 0.2 }, 1.35)
        .to(r.eyes, { x: 2 * M, y: M, duration: 0.15, ease: 'steps(2)' }, 1.35);

      // --- type ---
      let t = 1.6;
      for (let i = 0; i < 34; i++) {
        if (i === 17) {
          // stop to think: look up at the screen, hand hovers
          tl.to(r.eyes, { y: -M, duration: 0.1, ease: 'steps(1)' }, t)
            .to(hand, { y: 0, duration: 0.1 }, t)
            .to(r.body, { rotation: 3, y: 0, duration: 0.15 }, t)
            .to(r.eyes, { y: M, duration: 0.1, ease: 'steps(1)' }, t + 0.55)
            .to(r.body, { rotation: 7, y: 2, duration: 0.1 }, t + 0.55);
          t += 0.65;
        }
        tl.to(hand, { y: 4 * M, duration: 0.04, ease: 'steps(1)' }, t)
          .to(hand, { y: 2 * M, duration: 0.04, ease: 'steps(1)' }, t + 0.05)
          .to(r.body, { y: i % 2 ? 4 : 2, duration: 0.04, ease: 'steps(1)' }, t)
          .to(r.hands[0], { y: i % 4 < 2 ? -M : 0, duration: 0.04, ease: 'steps(1)' }, t)
          .call(sfx.tick, [], t);
        t += 0.09;
      }
      c.code.forEach((line, i) => tl.set(line, { attr: { opacity: 1 } }, 1.9 + i * 0.75));
      for (let k = 0; k < 12; k++) tl.set(c.cursor, { attr: { opacity: k % 2 ? 0 : 1 } }, 1.6 + k * 0.33);

      // --- done: stretch, then put everything away ---
      tl.to(r.eyes, { x: 0, y: 0, duration: 0.1, ease: 'steps(1)' }, t + 0.1)
        .to(r.body, { rotation: 0, y: -6, scaleY: 1.18, scaleX: 0.92, svgOrigin: '53 65', duration: 0.25, ease: 'back.out(3)' }, t + 0.1)
        .to(r.hands, { x: 0, y: -22, duration: 0.25, ease: 'back.out(3)' }, t + 0.1)
        .call(sfx.chime, [], t + 0.1);
      swapEyes(tl, r, c.happyEyes, t + 0.1);
      t += 0.8;
      tl.set(c.happyEyes, { attr: { opacity: 0 } }, t).set(r.eyes, { opacity: 1 }, t)
        .to(r.body, { y: 0, scaleY: 1, scaleX: 1, duration: 0.2 }, t)
        .to(r.hands[0], { y: 0, duration: 0.2 }, t)
        .to(hand, { x: 5 * M, y: 2 * M, duration: 0.15 }, t)
        // push the keyboard back behind Clawd
        .call(sfx.whoosh, [], t + 0.2)
        .to(c.keyboard, { x: -28 * M, duration: 0.3, ease: 'power3.in' }, t + 0.2)
        .to(hand, { x: -4 * M, duration: 0.3, ease: 'power3.in' }, t + 0.2)
        .to(r.body, { rotation: -6, duration: 0.3 }, t + 0.2)
        .set(c.keyboard, { attr: { opacity: 0 } }, t + 0.5)
        .set([...c.code, c.cursor], { attr: { opacity: 0 } }, t + 0.55)
        .to(c.monitor, { scaleY: 0, transformOrigin: '50% 100%', duration: 0.2, ease: 'steps(4)' }, t + 0.55)
        .to(c.desk, { scaleY: 0, transformOrigin: '50% 100%', duration: 0.2, ease: 'steps(4)' }, t + 0.75)
        .call(sfx.flip, [], t + 0.75)
        .to(hand, { x: 0, y: 0, duration: 0.2 }, t + 0.6)
        .to(r.body, { rotation: 0, y: 0, duration: 0.2 }, t + 0.6);
      takeOff(tl, c.headset, t + 1.0);
      return tl;
    },
  },

  skate: {
    label: '滑板', group: 'costume', weight: 0.6, svg: 'walk',
    run({ b }) {
      const r = svgs.walk.rig;
      const c = r.costume;
      let dir = Math.random() < 0.5 ? -1 : 1;
      const dist = rand(320, 520);
      if (b && Math.abs(clampX(b, b.x + dir * dist) - b.x) < 120) dir = -dir;
      const backLeg = dir > 0 ? r.legs[3] : r.legs[0];
      const lift = -6 * M; // the board is 6 cells tall
      const tl = gsap.timeline();
      wear(tl, c.skateboard);
      tl.fromTo(c.skateboard, { x: -60 * dir }, { x: 0, duration: 0.3, ease: 'power2.out' }, 0)
        .to(r.group, { y: lift - 30, duration: 0.18, ease: 'power2.out' }, 0.2) // hop on
        .to(r.group, { y: lift, duration: 0.15, ease: 'power2.in' }, 0.38)
        .to(r.body, { y: 12, duration: 0.15 }, 0.5) // crouch onto the deck
        .to(r.eyes, { x: 2 * M * dir, duration: 0.1, ease: 'steps(1)' }, 0.5)
        .to(backLeg, { y: -14, duration: 0.12, yoyo: true, repeat: 5 }, 0.55)
        .call(sfx.roll, [2.8], 0.6)
        .to(r.body, { rotation: -12 * dir, svgOrigin: '53 65', duration: 0.3 }, 0.9)
        .to(r.hands, { y: (i) => ((i === 0) === (dir > 0) ? 12 : -20), duration: 0.3 }, 0.9);
      if (b) moveWindow(tl, b, clampX(b, b.x + dir * dist), 2.4, 'power1.out', 0.6);
      // big ollie: board flips under the feet
      tl.call(sfx.boing, [3], 3.0)
        .to(r.body, { y: 18, duration: 0.08 }, 2.92)
        .to(r.group, { y: lift - 90, duration: 0.3, ease: 'power2.out' }, 3.0)
        .to(c.skateboard, { y: -20, duration: 0.3, ease: 'power2.out' }, 3.0)
        .to(c.skateboard, { scaleY: -1, transformOrigin: '50% 50%', duration: 0.3, ease: 'steps(2)', yoyo: true, repeat: 1 }, 3.0)
        .to(r.body, { rotation: 0, y: -8, duration: 0.2 }, 3.0)
        .to(r.hands, { y: -22, duration: 0.2 }, 3.0)
        .to(r.group, { y: lift, duration: 0.24, ease: 'power2.in' }, 3.32)
        .to(c.skateboard, { y: 0, duration: 0.24, ease: 'power2.in' }, 3.32)
        .call(sfx.thud, [2], 3.56)
        .to(r.body, { y: 16, scaleX: 1.15, scaleY: 0.82, svgOrigin: '53 65', duration: 0.06 }, 3.56)
        .to(r.body, { y: 0, scaleX: 1, scaleY: 1, duration: 0.25, ease: 'back.out(3)' }, 3.66)
        .to(r.hands, { y: 0, duration: 0.2 }, 3.66)
        .to(r.group, { y: 0, duration: 0.15 }, 3.8)
        .to(r.eyes, { x: 0, duration: 0.1, ease: 'steps(1)' }, 3.8);
      shake(tl, 3.56, 5);
      takeOff(tl, c.skateboard, 3.9);
      return tl;
    },
  },

  detective: {
    label: '侦探', group: 'costume', weight: 0.6, svg: 'walk',
    run({ b }) {
      const r = svgs.walk.rig;
      const c = r.costume;
      const dir = b && Math.abs(clampX(b, b.x - 160) - b.x) > 100 ? -1 : 1;
      const tl = gsap.timeline();
      popOn(tl, c.detHat);
      wear(tl, c.lens, 0.2);
      tl.fromTo(c.lens, { x: 30, y: 30 }, { x: 0, y: 0, duration: 0.3, ease: 'back.out(2)' }, 0.2);
      swapEyes(tl, r, c.detEyes, 0.4);
      // sneak along, crouched low, lens bobbing
      tl.to(r.body, { y: 12, rotation: 8 * dir, svgOrigin: '53 65', duration: 0.25 }, 0.4);
      for (let i = 0; i < 10; i++) {
        const t = 0.7 + i * 0.22;
        const legs = i % 2 ? [r.legs[0], r.legs[2]] : [r.legs[1], r.legs[3]];
        tl.to(legs, { y: -12, duration: 0.1, yoyo: true, repeat: 1 }, t)
          .to(r.body, { y: i % 2 ? 8 : 14, duration: 0.11 }, t)
          .to([c.lens, c.detEyes], { y: i % 2 ? -4 : 4, x: i % 2 ? -3 : 3, duration: 0.11 }, t);
      }
      if (b) moveWindow(tl, b, clampX(b, b.x + dir * 160), 2.2, 'sine.inOut', 0.7);
      // AHA!
      tl.call(sfx.aha, [], 3.1)
        .set(c.exclaim, { attr: { opacity: 1 } }, 3.1)
        .fromTo(c.exclaim, { y: 20, scale: 0.3, transformOrigin: '50% 100%' }, { y: 0, scale: 1.4, duration: 0.25, ease: 'back.out(4)' }, 3.1)
        .to(r.body, { y: -10, rotation: 0, scaleY: 1.2, scaleX: 0.9, duration: 0.15, ease: 'power2.out' }, 3.1)
        .to(r.group, { y: -30, duration: 0.2, yoyo: true, repeat: 1, ease: 'power2.out' }, 3.1)
        .to([c.lens, c.detEyes], { scale: 1.6, svgOrigin: at(20.5, 3.5), duration: 0.15, yoyo: true, repeat: 3 }, 3.1)
        .to(r.body, { y: 0, scaleY: 1, scaleX: 1, duration: 0.3, ease: 'back.out(2)' }, 3.55)
        .set(c.exclaim, { attr: { opacity: 0 } }, 4.2);
      takeOff(tl, [c.detHat, c.lens, c.detEyes], 4.3);
      return tl;
    },
  },

  builder: {
    label: '施工', group: 'costume', weight: 0.6, svg: 'walk',
    run() {
      const r = svgs.walk.rig;
      const c = r.costume;
      const pivot = at(27.5, 8); // where the right hand grips the handle
      // fix the pivot now, while the hammer is untransformed (setting it mid-drop shifts it)
      gsap.set(c.hammer, { svgOrigin: pivot, rotation: 0 });
      const tl = gsap.timeline();
      popOn(tl, c.hardhat);
      wear(tl, c.hammer, 0.15);
      tl
        .fromTo(c.hammer, { y: -60 }, { y: 0, duration: 0.25, ease: 'bounce.out' }, 0.15);
      for (let i = 0; i < 4; i++) {
        const t = 0.6 + i * 0.85;
        // wind up over the shoulder in pixel steps, then SLAM down to the right
        tl.to(c.hammer, { rotation: -60, duration: 0.3, ease: 'steps(3)' }, t)
          .to(r.hands[1], { y: -16, duration: 0.3 }, t)
          .to(r.body, { rotation: -10, y: -6, scaleY: 1.1, svgOrigin: '53 65', duration: 0.3 }, t)
          .to(c.hammer, { rotation: 115, duration: 0.12, ease: 'power3.in' }, t + 0.3)
          .to(r.hands[1], { y: 8, duration: 0.12 }, t + 0.3)
          .to(r.body, { rotation: 12, y: 10, scaleY: 0.85, duration: 0.12, ease: 'power3.in' }, t + 0.3)
          .call(sfx.clank, [], t + 0.42)
          .set(c.spark, { attr: { opacity: 1 } }, t + 0.42)
          .fromTo(c.spark, { scale: 0.4, transformOrigin: '50% 50%' }, { scale: 2, duration: 0.18, ease: 'steps(3)' }, t + 0.42)
          .set(c.spark, { attr: { opacity: 0 } }, t + 0.62)
          .to(r.group, { y: -10, duration: 0.08, yoyo: true, repeat: 1 }, t + 0.45)
          .to(c.hammer, { rotation: 0, duration: 0.25, ease: 'steps(3)' }, t + 0.6)
          .to(r.hands[1], { y: 0, duration: 0.2 }, t + 0.6)
          .to(r.body, { rotation: 0, y: 0, scaleY: 1, duration: 0.2 }, t + 0.6);
        shake(tl, t + 0.42, 8);
      }
      takeOff(tl, [c.hardhat, c.hammer], 4.1);
      return tl;
    },
  },

  chef: {
    label: '做饭', group: 'costume', weight: 0.6, svg: 'walk',
    run() {
      const r = svgs.walk.rig;
      const c = r.costume;
      const tl = gsap.timeline();
      popOn(tl, c.chefHat);
      wear(tl, [c.pan, c.pancake], 0.2);
      tl.fromTo([c.pan, c.pancake], { x: -40 }, { x: 0, duration: 0.25, ease: 'back.out(2)' }, 0.2);
      swapEyes(tl, r, c.happyEyes, 0.2);
      tl.call(sfx.sizzle, [3.8], 0.3).set(c.pancake, { transformOrigin: '50% 50%' }, 0);
      for (let i = 0; i < 3; i++) {
        const t = 0.6 + i * 1.05;
        const height = 110 + i * 25;
        tl.to(r.body, { y: 8, scaleY: 0.86, svgOrigin: '53 65', duration: 0.08 }, t - 0.08) // dip
          .to([r.hands[0], c.pan], { y: -18, duration: 0.08, ease: 'power2.out' }, t)
          .to([r.hands[0], c.pan], { y: 0, duration: 0.18 }, t + 0.08)
          .to(r.body, { y: -6, scaleY: 1.12, rotation: -10, duration: 0.12 }, t)
          .to(r.body, { y: 0, scaleY: 1, rotation: 0, duration: 0.2 }, t + 0.12)
          .call(sfx.flip, [], t)
          .to(c.pancake, { y: -height, duration: 0.36, ease: 'power2.out' }, t)
          .to(c.pancake, { rotation: '+=540', duration: 0.66, ease: 'steps(6)' }, t)
          .to(c.pancake, { y: 0, duration: 0.3, ease: 'power2.in' }, t + 0.36)
          .to(r.body, { y: 6, scaleY: 0.86, duration: 0.06, yoyo: true, repeat: 1 }, t + 0.66);
      }
      tl.to(r.group, { y: -40, duration: 0.2, yoyo: true, repeat: 1, ease: 'power2.out' }, 3.8)
        .to(r.hands, { y: -20, duration: 0.2, yoyo: true, repeat: 1 }, 3.8);
      takeOff(tl, [c.chefHat, c.pan, c.pancake], 4.3);
      return tl;
    },
  },

  cowboy: {
    label: '牛仔', group: 'costume', weight: 0.6, svg: 'walk',
    run({ b }) {
      const r = svgs.walk.rig;
      const c = r.costume;
      const tl = gsap.timeline();
      popOn(tl, c.cowboyHat);
      wear(tl, [c.rope, c.lasso], 0.3);
      tl.set(c.lasso, { svgOrigin: at(29, -20) }, 0)
        .to([r.hands[1], c.rope, c.lasso], { y: -16, duration: 0.2 }, 0.3);
      for (let i = 0; i < 6; i++) {
        const t = 0.5 + i * 0.36;
        tl.to(c.lasso, { scaleX: -1, duration: 0.18, ease: 'steps(3)' }, t)
          .to(c.lasso, { scaleX: 1, duration: 0.18, ease: 'steps(3)' }, t + 0.18)
          .to(r.body, { rotation: i % 2 ? 10 : -10, svgOrigin: '53 65', duration: 0.18 }, t)
          .to(r.group, { y: i % 2 ? 0 : -10, duration: 0.18 }, t)
          .call(sfx.whoosh, [], t);
      }
      // throw it far, then a big "yeehaw" with the hat thrown up and caught
      tl.set(c.rope, { attr: { opacity: 0 } }, 2.75)
        .to(c.lasso, { x: 140, y: 70, duration: 0.4, ease: 'power2.out' }, 2.75)
        .to(c.lasso, { attr: { opacity: 0 }, duration: 0.15 }, 3.05)
        .to(r.hands[1], { y: 0, duration: 0.2 }, 2.75)
        .to(r.body, { rotation: 12, duration: 0.15 }, 2.75)
        .call(sfx.yeehaw, [], 3.15)
        .to(r.body, { rotation: 0, duration: 0.2 }, 3.15)
        .set(c.cowboyHat, { svgOrigin: at(12, -8) }, 3.15)
        .to(c.cowboyHat, { y: -70, duration: 0.4, ease: 'power2.out' }, 3.15)
        .to(c.cowboyHat, { keyframes: { scaleX: [1, 0.4, -1, -0.4, 1, 0.4, -1, -0.4, 1] }, duration: 0.75, ease: 'steps(8)' }, 3.15)
        .to(c.cowboyHat, { y: 0, duration: 0.35, ease: 'power2.in' }, 3.55)
        .to(r.group, { y: -36, duration: 0.2, yoyo: true, repeat: 1, ease: 'power2.out' }, 3.15)
        .to(r.hands, { y: -20, duration: 0.2, yoyo: true, repeat: 1 }, 3.15);
      if (b) moveWindow(tl, b, clampX(b, b.x + 40), 0.3, 'power2.out', 2.75);
      takeOff(tl, c.cowboyHat, 4.1);
      return tl;
    },
  },

  wizard: {
    label: '魔法', group: 'costume', weight: 0.6, svg: 'walk',
    run() {
      const r = svgs.walk.rig;
      const c = r.costume;
      // fix the pivot while the wand is untransformed (the scale-0 fromTo below renders at once)
      gsap.set(c.wand, { svgOrigin: at(27, 11), rotation: 0, scale: 1, y: 0 });
      const tl = gsap.timeline();
      popOn(tl, c.wizHat);
      wear(tl, c.wand, 0.2);
      swapEyes(tl, r, c.happyEyes, 0.2);
      tl.fromTo(c.wand, { scale: 0 }, { scale: 1, duration: 0.25, ease: 'steps(3)' }, 0.2);
      for (let i = 0; i < 3; i++) {
        const t = 0.6 + i * 0.85;
        tl.to([c.wand, r.hands[1]], { y: -16, duration: 0.15 }, t)
          .to(c.wand, { rotation: -25, duration: 0.15, ease: 'steps(2)' }, t)
          .to(r.body, { rotation: -12, y: -4, svgOrigin: '53 65', duration: 0.15 }, t)
          .to(c.wand, { rotation: 20, duration: 0.15, ease: 'steps(2)' }, t + 0.15)
          .to(c.wand, { rotation: 0, duration: 0.15, ease: 'steps(2)' }, t + 0.35)
          .to(r.body, { rotation: 8, y: 4, duration: 0.15, ease: 'power2.in' }, t + 0.15)
          .to([c.wand, r.hands[1]], { y: 0, duration: 0.2 }, t + 0.3)
          .call(sfx.chime, [], t + 0.25);
        burst(tl, c.sparkles, t + 0.3, { spread: 34 + i * 16 });
      }
      tl.to(r.body, { rotation: 0, y: 0, duration: 0.2 }, 3.2)
        .to(r.group, { y: -50, duration: 0.25, yoyo: true, repeat: 1, ease: 'power2.out' }, 3.25)
        .to(r.hands, { y: -22, duration: 0.25, yoyo: true, repeat: 1 }, 3.25);
      burst(tl, c.sparkles, 3.4, { spread: 80 });
      takeOff(tl, [c.wizHat, c.wand], 4.0);
      return tl;
    },
  },

  astronaut: {
    label: '太空漫步', group: 'costume', weight: 0.6, svg: 'walk',
    run() {
      const r = svgs.walk.rig;
      const c = r.costume;
      const tl = gsap.timeline();
      popOn(tl, [c.helmet, c.antennaLight]);
      for (let k = 0; k < 14; k++) tl.set(c.antennaLight, { attr: { opacity: k % 2 ? 0 : 1 } }, 0.3 + k * 0.3);
      tl.call(sfx.blip, [], 0.4)
        .to(r.group, { y: -95, duration: 1.6, ease: 'sine.inOut' }, 0.5)
        .to(r.group, { keyframes: { rotation: [0, 20, -16, 22, 0] }, svgOrigin: '53 50', duration: 3.6, ease: 'sine.inOut' }, 0.5)
        .to(r.legs, { rotation: (i) => (i % 2 ? 18 : -18), transformOrigin: '50% 57%', duration: 0.7, yoyo: true, repeat: 4, ease: 'sine.inOut' }, 0.6)
        .to(r.hands, { y: (i) => (i ? -20 : 14), duration: 0.7, yoyo: true, repeat: 4, ease: 'sine.inOut' }, 0.6)
        .call(sfx.blip, [], 2.0)
        .call(sfx.blip, [], 3.2)
        .to(r.group, { y: 0, duration: 1.4, ease: 'sine.in' }, 2.8)
        .call(sfx.thud, [2], 4.2)
        .to(r.body, { scaleY: 0.7, scaleX: 1.18, svgOrigin: '53 65', duration: 0.08, yoyo: true, repeat: 1 }, 4.2);
      shake(tl, 4.2, 6);
      takeOff(tl, [c.helmet, c.antennaLight], 4.6);
      return tl;
    },
  },

  party: {
    label: '庆祝', group: 'costume', weight: 0.6, svg: 'walk',
    run() {
      const r = svgs.walk.rig;
      const c = r.costume;
      const tl = gsap.timeline();
      popOn(tl, c.fuse);
      swapEyes(tl, r, c.happyEyes);
      // sparkles fizz from the top of the fuse (cell 16, -10) rather than the wand tip
      const fx = (15 - 45) * M;
      const fy = (-12 - 3) * M;
      for (let i = 0; i < 8; i++) burst(tl, c.sparkles, 0.2 + i * 0.35, { dx: fx, dy: fy, spread: 22, arc: [-Math.PI, 0] });
      [0.5, 1.4, 2.3].forEach((t, i) => {
        tl.call(sfx.toot, [], t)
          .to(r.hands, { y: -26, duration: 0.12 }, t)
          .to(r.body, { scaleY: 1.2, scaleX: 0.9, svgOrigin: '53 65', duration: 0.12 }, t)
          .to(r.group, { y: -60 - i * 15, duration: 0.24, ease: 'power2.out' }, t)
          .to(r.group, { rotation: i === 2 ? 360 : 0, svgOrigin: '53 45', duration: 0.4, ease: 'steps(4)' }, t)
          .to(r.group, { y: 0, duration: 0.22, ease: 'power2.in' }, t + 0.24)
          .to(r.body, { scaleY: 0.75, scaleX: 1.16, duration: 0.06 }, t + 0.46)
          .to(r.body, { scaleY: 1, scaleX: 1, duration: 0.2, ease: 'back.out(3)' }, t + 0.52)
          .to(r.hands, { y: 0, duration: 0.2 }, t + 0.46);
        shake(tl, t + 0.46, 4);
      });
      tl.set(r.group, { rotation: 0 }, 3.0);
      burst(tl, c.sparkles, 2.9, { dx: fx, dy: fy, spread: 80, arc: [-Math.PI, 0] });
      takeOff(tl, c.fuse, 3.5);
      return tl;
    },
  },

  cool: {
    label: '戴墨镜', group: 'costume', weight: 0.6, svg: 'walk',
    run() {
      const r = svgs.walk.rig;
      const c = r.costume;
      const tl = gsap.timeline();
      tl.set(c.glasses, { attr: { opacity: 1 } }, 0.2)
        .fromTo(c.glasses, { y: -200 }, { y: 0, duration: 0.6, ease: 'power3.in' }, 0.2)
        .set(r.eyes, { opacity: 0 }, 0.8)
        .call(sfx.thunk, [], 0.8)
        .to(r.body, { y: 12, scaleY: 0.78, scaleX: 1.12, svgOrigin: '53 65', duration: 0.06, yoyo: true, repeat: 1 }, 0.8)
        .to(r.body, { y: 6, rotation: 12, duration: 0.3, yoyo: true, repeat: 5, ease: 'steps(2)' }, 1.2)
        .to(r.hands, { y: (i) => (i ? -26 : 10), duration: 0.3, yoyo: true, repeat: 5, ease: 'steps(2)' }, 1.2)
        .to(c.glasses, { y: -40, attr: { opacity: 0 }, duration: 0.3, ease: 'back.in(2)' }, 3.2)
        .set(r.eyes, { opacity: 1 }, 3.2);
      shake(tl, 0.8, 7);
      return tl;
    },
  },
};
