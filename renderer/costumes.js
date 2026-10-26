/* global gsap, svgs, moveWindow, clampX, rand, sfx */
// Costume actions modelled on Anthropic's Clawd illustrations (headphones, chef, cowboy, ...).
// Every accessory is pixel art written as an ASCII grid below and drawn as <rect>s onto the
// walk rig, so it tilts and bounces with the body. Loaded before pet.js, which merges
// costumeActions into its action list and calls buildCostumes() after the rigs exist.
//
// Grid: Clawd is 12x8 "big" pixels (C = 10.625 SVG units; body = columns 2-9, from x = 11).
// Accessories use a finer grid of M = C / 3, like the official art. Sprite positions are in
// those fine cells (mx, my), measured from the body's top-left corner.

const C = 10.625;
const M = C / 3;
const BODY_X = 11;

const PAL = {
  K: '#1d1d1f', W: '#ffffff', l: '#cfd6da', G: '#9aa0a6', g: '#5f6368',
  B: '#2b5797', b: '#bfe3f2', Y: '#f4c542', O: '#d9962b', N: '#5c3a1e', n: '#7d5230',
  T: '#c9974f', P: '#4b4aa8', V: '#2f2d72', R: '#d94c3d', M: '#5a1f2f',
  I: '#3b3f9e', C: '#DD775B', F: '#ffe9a8',
};

// parent: 'body' moves with the torso, 'group' with the whole character.
const SPRITES = {
  // big round cups straddling the head, stepped band well above it (ref: headphones)
  headphones: { parent: 'body', mx: -4, my: -8, rows: [
    '..........BBBBBBBBBBBB..........',
    '........BBBBBBBBBBBBBBBB........',
    '......BBBB............BBBB......',
    '.....BBB................BBB.....',
    '....BB....................BB....',
    '...BB......................BB...',
    '..BB........................BB..',
    '..BB........................BB..',
    '.BBBB......................BBBB.',
    'BBBBB......................BBBBB',
    'BBBBB......................BBBBB',
    'BBBBB......................BBBBB',
    'BBBBB......................BBBBB',
    'BBBBB......................BBBBB',
    'BBBBB......................BBBBB',
    '.BBBB......................BBBB.',
  ] },
  // light headset + keyboard on a little stand (ref: typing)
  headset: { parent: 'body', mx: -4, my: -8, rows: [
    '..........llllllllllll..........',
    '........llllllllllllllll........',
    '......llll............llll......',
    '.....lll................lll.....',
    '....ll....................ll....',
    '...ll......................ll...',
    '..ll........................ll..',
    '..ll........................ll..',
    '.llll......................llll.',
    'lllll......................lllll',
    'lllll......................lllll',
    'lllll......................lllll',
    'lllll......................lllll',
    'lllll......................lllll',
    'lllll......................lllll',
    '.llll......................llll.',
  ] },
  keyboard: { parent: 'group', mx: 2, my: 13, rows: [
    'gGGBGGGBGGBGGGBGGBGGGBGGg',
    'gWWWWWWWWWWWWWWWWWWWWWWWg',
    'ggggggggggggggggggggggggg',
    '.g.....................g.',
    '.g.....................g.',
    '.g.....................g.',
    '.g.....................g.',
    '.g.....................g.',
    '.g.....................g.',
    '.g.....................g.',
    '.g.....................g.',
  ] },
  // maroon deck, yellow wheels under the outer legs (ref: skateboard)
  skateboard: { parent: 'group', mx: -3, my: 24, rows: [
    'MMMMMMMMMMMMMMMMMMMMMMMMMMMMMM',
    '.MMMMMMMMMMMMMMMMMMMMMMMMMMMM.',
    '...YOY..................YOY...',
    '...OYY..................YYO...',
  ] },
  // black fedora with brown band, brim wider than the body (ref: detective)
  detHat: { parent: 'body', mx: -3, my: -6, rows: [
    '......KKKKKKKK..KKKKKKKK......',
    '......KKKKKKKKKKKKKKKKKK......',
    '......KKKKKKKKKKKKKKKKKK......',
    '......NNNNNNNNNNNNNNNNNN......',
    '......NNNNNNNNNNNNNNNNNN......',
    'KKKKKKKKKKKKKKKKKKKKKKKKKKKKKK',
    'KKKKKKKKKKKKKKKKKKKKKKKKKKKKKK',
  ] },
  // one eye squinting, the other blown up behind the lens
  detEyes: { parent: 'body', mx: 3, my: 2, rows: [
    '..............KKKKK',
    '..............KKKKK',
    'KKK...........KKKKK',
    '..............KKKKK',
    '..............KKKKK',
  ] },
  lens: { parent: 'body', mx: 15, my: -1, rows: [
    '..IIIII.....',
    '.I.....I....',
    'I.b.....I...',
    'I.......I...',
    'I.......I...',
    'I.......I...',
    'I.......I...',
    '.I.....II...',
    '..IIIII.II..',
    '.........II.',
    '..........II',
    '...........I',
  ] },
  exclaim: { parent: 'body', mx: 11, my: -13, rows: ['RR', 'RR', 'RR', 'RR', '..', 'RR'] },
  // yellow hard hat with ridges and a cross emblem (ref: builder)
  hardhat: { parent: 'body', mx: -2, my: -6, rows: [
    '........OOOOOOOOOOOO........',
    '......OOYYYOYYYYOYYYOO......',
    '.....OYYYYOYYOOYYOYYYYO.....',
    '.....OYYYYOYOOOOYOYYYYO.....',
    '.....OYYYYOYYOOYYOYYYYO.....',
    '.....OYYYYOYYYYYYOYYYYO.....',
    'OOOOOOOOOOOOOOOOOOOOOOOOOOOO',
    '.YYYYYYYYYYYYYYYYYYYYYYYYYY.',
  ] },
  hammer: { parent: 'body', mx: 26, my: 9, rows: ['..g..', '..g..', '..g..', '..g..', 'lllll', 'lllll', 'GGGGG'] },
  spark: { parent: 'body', mx: 24, my: 15, rows: ['.F.F.', 'F.W.F', '.WWW.', 'F.W.F', '.F.F.'] },
  // tall puffy toque that covers the top of the head (ref: chef)
  chefHat: { parent: 'body', mx: -1, my: -10, rows: [
    '........WWWWWWWWWW........',
    '...WWWWWWWWlWWWWWWWWWWW...',
    '.WWWWWWWWWlWWWWWWlWWWWWWW.',
    'WWWWWWWWWWWWWWWWWlWWWWWWWW',
    'WWWWWlWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWlWWWW',
    '.WWWWWWWWWWWWWWWWWWWWWWWW.',
    '..WWWWWWWWWWWWWWWWWWWWWW..',
    '..WWWWWWWWWWWWWWWWWWWWWW..',
    '..llllllllllllllllllllll..',
    '..WWWWWWWWWWWWWWWWWWWWWW..',
    '..WWWWWWWWWWWWWWWWWWWWWW..',
  ] },
  pan: { parent: 'body', mx: -18, my: 5, rows: ['ggggggggg......', 'gggggggggNNNNNN'] },
  pancake: { parent: 'body', mx: -17, my: 2, rows: ['.OOOOOO.', 'OYYYYYYO', '.OOOOOO.'] },
  // dark brown hat, wide brim curling up at the ends (ref: cowboy)
  cowboyHat: { parent: 'body', mx: -6, my: -8, rows: [
    '............NNNNN..NNNNN............',
    '...........NNNNNNNNNNNNNN...........',
    '...........NNNnnnnnnnnNNN...........',
    '..........NNNNNNNNNNNNNNNN..........',
    '..........NNnnnnnnnnnnnnNN..........',
    '..........KKKKKKKKKKKKKKKK..........',
    'NN........NNNNNNNNNNNNNNNN........NN',
    'NNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNN',
    '.nnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnn.',
    '...NNNNNNNNNNNNNNNNNNNNNNNNNNNNNN...',
  ] },
  rope: { parent: 'body', mx: 27, my: -5, rows: Array(11).fill('T') },
  lasso: { parent: 'body', mx: 19, my: -13, rows: [
    '.....TTTTTTTT.....',
    '..TTT........TTT..',
    '.T..............T.',
    'T................T',
    'T................T',
    '.T..............T.',
    '..TTT........TTT..',
    '.....TTTTTTTT.....',
  ] },
  // starry navy hat with a crooked tip and dark band (ref: wizard)
  wizHat: { parent: 'body', mx: -2, my: -9, rows: [
    '....PPP.....................',
    '.....PPPP...................',
    '........PPPP................',
    '.........PPWPPP.............',
    '........PPPPPPPPW...........',
    '.......PWPPPPPPPPPP.........',
    '......PPPPPPWPPPPPPPP.......',
    '.....PPPWPPPPPPPPWPPPP......',
    '....VVVVVVVVVVVVVVVVVVVV....',
    '.PPPWPPPPPPPWPPPPPPPWPPPPPP.',
  ] },
  wand: { parent: 'body', mx: 27, my: 8, rows: ['KKKKKKW'] },
  helmet: { parent: 'body', mx: -3, my: -7, rows: [
    '..........WWWWWWWWWW..........',
    '.......WWW..........WWW.......',
    '.....WW................WW.....',
    '....W..................bbW....',
    '...W....................bW....',
    '..W.......................W...',
    '..W........................W..',
    '.W..........................W.',
    '.W..........................W.',
    '.W..........................W.',
    '.W..........................W.',
    '.W..........................W.',
    '.W..........................W.',
    '.W..........................W.',
    '.W..........................W.',
    '.W..........................W.',
    '.W..........................W.',
    '.llllllllllllllllllllllllllll.',
  ] },
  // a body-coloured fuse on the head, fizzing (ref: celebration)
  fuse: { parent: 'body', mx: 15, my: -4, rows: ['CC', 'CC', 'CC', 'CC'] },
  glasses: { parent: 'body', mx: 1, my: 2, rows: [
    'KKKKKKKKKKKKKKKKKKKKKK',
    'KWWKKKKKK....KWWKKKKKK',
    'KWKKKKKKK....KWKKKKKKK',
    '.KKKKKKK......KKKKKKK.',
    '..KKKKK........KKKKK..',
  ] },
  happyEyes: { parent: 'body', mx: 2, my: 3, rows: [
    '.KKK..........KKK.',
    'K...K........K...K',
  ] },
};

const NOTE_ROWS = ['.KK', '.K.', '.K.', 'KK.', 'KK.'];
const SPARKLE_ROWS = ['.F.', 'FWF', '.F.'];

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
  const parents = { body: r.body, group: r.group };
  const c = {};
  for (const [name, def] of Object.entries(SPRITES)) c[name] = pixelSprite(parents[def.parent], def);
  c.notes = [[26, -6], [-5, -8]].map(([mx, my]) => pixelSprite(r.group, { mx, my, rows: NOTE_ROWS }));
  c.sparkles = Array.from({ length: 7 }, () => pixelSprite(r.body, { mx: 33, my: 7, rows: SPARKLE_ROWS }));
  r.costume = c;
  r.costumeParts = [...Object.values(c)].flat();
}

// Helpers shared by the costume timelines.
const wear = (tl, parts, at0 = 0) => tl.set(parts, { attr: { opacity: 1 } }, at0);
const takeOff = (tl, parts, t) => tl.to(parts, { y: '-=10', attr: { opacity: 0 }, duration: 0.25, ease: 'power1.in' }, t);
const swapEyes = (tl, r, eyes, t = 0) => tl.set(r.eyes, { opacity: 0 }, t).set(eyes, { attr: { opacity: 1 } }, t);
// Sparkles fly out from (dx, dy) relative to their home spot at the wand tip.
function burst(tl, sparkles, t, { dx = 0, dy = 0, spread = 28, arc = [0, Math.PI * 2] } = {}) {
  sparkles.forEach((s, i) => {
    const a = arc[0] + ((i + 0.5) / sparkles.length) * (arc[1] - arc[0]) + rand(-0.2, 0.2);
    tl.fromTo(s, { x: dx, y: dy, scale: 1.4, transformOrigin: '50% 50%', attr: { opacity: 1 } }, {
      x: dx + Math.cos(a) * spread, y: dy + Math.sin(a) * spread, scale: 0.6, attr: { opacity: 0 }, duration: 0.7, ease: 'power2.out',
    }, t);
  });
}

const costumeActions = {
  music: {
    label: '听歌', group: 'costume', weight: 0.6, svg: 'walk',
    run() {
      const r = svgs.walk.rig;
      const c = r.costume;
      const tl = gsap.timeline();
      wear(tl, c.headphones);
      swapEyes(tl, r, c.happyEyes);
      tl.call(sfx.melody, [4], 0.1);
      for (let i = 0; i < 10; i++) {
        const t = 0.2 + i * 0.4;
        tl.to(r.body, { y: 6, rotation: i % 2 ? 6 : -6, scaleY: 0.92, svgOrigin: '53 65', duration: 0.2, ease: 'power2.out' }, t)
          .to(r.body, { y: -3, rotation: 0, scaleY: 1.05, duration: 0.2, ease: 'power2.in' }, t + 0.2)
          .to(r.hands, { y: i % 2 ? -8 : 4, duration: 0.2 }, t);
      }
      c.notes.forEach((n, i) => {
        const side = i ? -1 : 1;
        tl.fromTo(n, { x: 0, y: 0, attr: { opacity: 0 } }, {
          keyframes: [{ attr: { opacity: 1 }, x: 8 * side, y: -14, duration: 0.4 }, { attr: { opacity: 0 }, x: 20 * side, y: -50, duration: 0.9 }],
          ease: 'none', repeat: 2, repeatDelay: 0.2,
        }, 0.3 + i * 0.6);
      });
      tl.to([r.body, r.hands], { y: 0, rotation: 0, scaleY: 1, duration: 0.2 }, 4.2);
      takeOff(tl, c.headphones, 4.3);
      return tl;
    },
  },

  typing: {
    label: '敲代码', group: 'costume', weight: 0.6, svg: 'walk',
    run() {
      const r = svgs.walk.rig;
      const c = r.costume;
      const tl = gsap.timeline();
      wear(tl, [c.headset, c.keyboard]);
      tl.to(r.eyes, { y: 4, duration: 0.2 }, 0)
        .to(r.body, { rotation: 4, y: 3, svgOrigin: '53 65', duration: 0.25 }, 0);
      for (let i = 0; i < 36; i++) {
        const t = 0.3 + i * 0.09 + (i >= 18 ? 0.6 : 0);
        const hand = r.hands[i % 2];
        tl.to(hand, { y: 9, duration: 0.04 }, t).to(hand, { y: 0, duration: 0.04 }, t + 0.045)
          .to(r.body, { y: i % 2 ? 4 : 2, duration: 0.04 }, t)
          .call(sfx.tick, [], t);
      }
      tl.to(r.eyes, { y: 0, duration: 0.2 }, 4.3)
        .to(r.hands, { y: -18, duration: 0.25, ease: 'back.out(3)' }, 4.3)
        .to(r.body, { rotation: 0, y: -4, scaleY: 1.14, svgOrigin: '53 65', duration: 0.25 }, 4.3)
        .call(sfx.chime, [], 4.3)
        .to(r.hands, { y: 0, duration: 0.25 }, 4.9)
        .to(r.body, { y: 0, scaleY: 1, duration: 0.3, ease: 'back.out(2)' }, 4.9);
      takeOff(tl, [c.headset, c.keyboard], 5.1);
      return tl;
    },
  },

  skate: {
    label: '滑板', group: 'costume', weight: 0.6, svg: 'walk',
    run({ b }) {
      const r = svgs.walk.rig;
      const c = r.costume;
      let dir = Math.random() < 0.5 ? -1 : 1;
      const dist = rand(260, 420);
      if (b && Math.abs(clampX(b, b.x + dir * dist) - b.x) < 100) dir = -dir;
      const backLeg = dir > 0 ? r.legs[3] : r.legs[0];
      const lift = -4 * M; // the board is 4 fine cells tall
      const tl = gsap.timeline();
      wear(tl, c.skateboard);
      tl.to(r.group, { y: lift, duration: 0.15, ease: 'power2.out' }, 0)
        .to(r.body, { y: 9, duration: 0.15 }, 0) // crouch onto the deck
        .to(r.eyes, { x: 4 * dir, duration: 0.2 }, 0)
        .to(backLeg, { y: -10, duration: 0.12, yoyo: true, repeat: 3 }, 0.2)
        .call(sfx.roll, [2.6], 0.3)
        .to(r.body, { rotation: -6 * dir, svgOrigin: '53 65', duration: 0.3 }, 0.6)
        .to(r.hands, { y: (i) => ((i === 0) === (dir > 0) ? 8 : -12), duration: 0.3 }, 0.6);
      if (b) moveWindow(tl, b, clampX(b, b.x + dir * dist), 2.4, 'power1.out', 0.3);
      // ollie
      tl.call(sfx.boing, [2], 2.8)
        .to(r.body, { y: 14, duration: 0.08 }, 2.72)
        .to(r.group, { y: lift - 50, duration: 0.24, ease: 'power2.out' }, 2.8)
        .to(r.body, { rotation: 0, y: -4, duration: 0.2 }, 2.8)
        .to(r.hands, { y: -14, duration: 0.2 }, 2.8)
        .to(r.group, { y: lift, duration: 0.2, ease: 'power2.in' }, 3.08)
        .call(sfx.thud, [1], 3.28)
        .to(r.body, { y: 12, duration: 0.06 }, 3.28)
        .to(r.body, { y: 0, duration: 0.2, ease: 'back.out(2)' }, 3.4)
        .to(r.hands, { y: 0, duration: 0.2 }, 3.4)
        .to(r.group, { y: 0, duration: 0.15 }, 3.5)
        .to(r.eyes, { x: 0, duration: 0.2 }, 3.5);
      takeOff(tl, c.skateboard, 3.6);
      return tl;
    },
  },

  detective: {
    label: '侦探', group: 'costume', weight: 0.6, svg: 'walk',
    run({ b }) {
      const r = svgs.walk.rig;
      const c = r.costume;
      const dir = b && Math.abs(clampX(b, b.x - 140) - b.x) > 100 ? -1 : 1;
      const tl = gsap.timeline();
      wear(tl, [c.detHat, c.lens]);
      swapEyes(tl, r, c.detEyes);
      // tiptoe along, crouched, lens bobbing
      tl.to(r.body, { y: 6, rotation: 5 * dir, svgOrigin: '53 65', duration: 0.25 }, 0);
      for (let i = 0; i < 10; i++) {
        const t = 0.3 + i * 0.22;
        const legs = i % 2 ? [r.legs[0], r.legs[2]] : [r.legs[1], r.legs[3]];
        tl.to(legs, { y: -8, duration: 0.1, yoyo: true, repeat: 1 }, t)
          .to(r.body, { y: i % 2 ? 4 : 8, duration: 0.11 }, t)
          .to([c.lens, c.detEyes], { y: i % 2 ? -2 : 2, duration: 0.11 }, t);
      }
      if (b) moveWindow(tl, b, clampX(b, b.x + dir * 140), 2.2, 'sine.inOut', 0.3);
      // aha!
      tl.call(sfx.aha, [], 2.7)
        .set(c.exclaim, { attr: { opacity: 1 } }, 2.7)
        .fromTo(c.exclaim, { y: 8, scale: 0.4, transformOrigin: '50% 100%' }, { y: 0, scale: 1.3, duration: 0.25, ease: 'back.out(4)' }, 2.7)
        .to(r.body, { y: -6, rotation: 0, scaleY: 1.12, duration: 0.15, ease: 'power2.out' }, 2.7)
        .to(r.group, { y: -22, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.out' }, 2.7)
        .to([c.lens, c.detEyes], { scale: 1.35, svgOrigin: at(19.5, 4.5), duration: 0.15, yoyo: true, repeat: 3 }, 2.7)
        .to(r.body, { y: 0, scaleY: 1, duration: 0.3, ease: 'back.out(2)' }, 3.2)
        .set(c.exclaim, { attr: { opacity: 0 } }, 3.9);
      takeOff(tl, [c.detHat, c.lens, c.detEyes], 4.0);
      return tl;
    },
  },

  builder: {
    label: '施工', group: 'costume', weight: 0.6, svg: 'walk',
    run() {
      const r = svgs.walk.rig;
      const c = r.costume;
      const pivot = at(28.5, 9); // where the right hand grips the handle
      const tl = gsap.timeline();
      wear(tl, [c.hardhat, c.hammer]);
      tl.set(c.hammer, { svgOrigin: pivot, rotation: 0 }, 0);
      for (let i = 0; i < 4; i++) {
        const t = 0.3 + i * 0.75;
        tl.to(c.hammer, { rotation: -170, duration: 0.3, ease: 'power2.out' }, t)
          .to(r.hands[1], { y: -14, duration: 0.3 }, t)
          .to(r.body, { rotation: -6, y: -3, svgOrigin: '53 65', duration: 0.3 }, t)
          .to(c.hammer, { rotation: 10, duration: 0.12, ease: 'power3.in' }, t + 0.3)
          .to(r.hands[1], { y: 6, duration: 0.12 }, t + 0.3)
          .to(r.body, { rotation: 7, y: 6, duration: 0.12, ease: 'power3.in' }, t + 0.3)
          .call(sfx.clank, [], t + 0.42)
          .set(c.spark, { attr: { opacity: 1 } }, t + 0.42)
          .fromTo(c.spark, { scale: 0.5, transformOrigin: '50% 50%' }, { scale: 1.8, duration: 0.15 }, t + 0.42)
          .set(c.spark, { attr: { opacity: 0 } }, t + 0.6)
          .to(r.group, { keyframes: { x: [3, -3, 2, 0] }, duration: 0.15 }, t + 0.42)
          .to(c.hammer, { rotation: 0, duration: 0.2 }, t + 0.55)
          .to(r.hands[1], { y: 0, duration: 0.2 }, t + 0.55)
          .to(r.body, { rotation: 0, y: 0, duration: 0.2 }, t + 0.55);
      }
      takeOff(tl, [c.hardhat, c.hammer], 3.5);
      return tl;
    },
  },

  chef: {
    label: '做饭', group: 'costume', weight: 0.6, svg: 'walk',
    run() {
      const r = svgs.walk.rig;
      const c = r.costume;
      const tl = gsap.timeline();
      wear(tl, [c.chefHat, c.pan, c.pancake]);
      swapEyes(tl, r, c.happyEyes);
      tl.call(sfx.sizzle, [3.6], 0.1).set(c.pancake, { transformOrigin: '50% 50%' }, 0);
      for (let i = 0; i < 3; i++) {
        const t = 0.4 + i * 1.0;
        tl.to([r.hands[0], c.pan], { y: -10, duration: 0.08, ease: 'power2.out' }, t)
          .to([r.hands[0], c.pan], { y: 0, duration: 0.15 }, t + 0.08)
          .to(r.body, { rotation: -6, svgOrigin: '53 65', duration: 0.1, yoyo: true, repeat: 1 }, t)
          .call(sfx.flip, [], t)
          .to(c.pancake, { y: -70, duration: 0.32, ease: 'power2.out' }, t)
          .to(c.pancake, { rotation: '+=360', duration: 0.6, ease: 'none' }, t)
          .to(c.pancake, { y: 0, duration: 0.26, ease: 'power2.in' }, t + 0.32)
          .to(r.body, { y: 4, scaleY: 0.9, duration: 0.06, yoyo: true, repeat: 1 }, t + 0.58);
      }
      tl.to(r.group, { y: -16, duration: 0.15, yoyo: true, repeat: 1 }, 3.3);
      takeOff(tl, [c.chefHat, c.pan, c.pancake], 3.7);
      return tl;
    },
  },

  cowboy: {
    label: '牛仔', group: 'costume', weight: 0.6, svg: 'walk',
    run({ b }) {
      const r = svgs.walk.rig;
      const c = r.costume;
      const tl = gsap.timeline();
      wear(tl, [c.cowboyHat, c.rope, c.lasso]);
      tl.set(c.lasso, { svgOrigin: at(28, -9) }, 0)
        .to([r.hands[1], c.rope, c.lasso], { y: -12, duration: 0.2 }, 0);
      for (let i = 0; i < 6; i++) {
        const t = 0.25 + i * 0.4;
        tl.to(c.lasso, { scaleX: -1, duration: 0.2, ease: 'sine.inOut' }, t)
          .to(c.lasso, { scaleX: 1, duration: 0.2, ease: 'sine.inOut' }, t + 0.2)
          .to(r.body, { rotation: i % 2 ? 6 : -6, svgOrigin: '53 65', duration: 0.2 }, t)
          .call(sfx.whoosh, [], t);
      }
      tl.set(c.rope, { attr: { opacity: 0 } }, 2.7)
        .to(c.lasso, { x: 90, y: 50, duration: 0.35, ease: 'power2.out' }, 2.7)
        .to(c.lasso, { attr: { opacity: 0 }, duration: 0.15 }, 2.95)
        .to(r.hands[1], { y: 0, duration: 0.2 }, 2.7)
        .to(r.body, { rotation: 6, duration: 0.15 }, 2.7)
        .call(sfx.yeehaw, [], 3.1)
        .to(r.body, { rotation: 0, duration: 0.2 }, 3.1)
        .set(c.cowboyHat, { svgOrigin: at(12, 1) }, 3.1)
        .to(c.cowboyHat, { rotation: -18, y: -10, duration: 0.15, yoyo: true, repeat: 1 }, 3.1)
        .to(r.group, { y: -26, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.out' }, 3.1);
      if (b) moveWindow(tl, b, clampX(b, b.x + 30), 0.3, 'power2.out', 2.7);
      takeOff(tl, c.cowboyHat, 3.7);
      return tl;
    },
  },

  wizard: {
    label: '魔法', group: 'costume', weight: 0.6, svg: 'walk',
    run() {
      const r = svgs.walk.rig;
      const c = r.costume;
      const tl = gsap.timeline();
      wear(tl, [c.wizHat, c.wand]);
      swapEyes(tl, r, c.happyEyes);
      tl.set(c.wand, { svgOrigin: at(27, 8.5) }, 0);
      for (let i = 0; i < 3; i++) {
        const t = 0.3 + i * 0.8;
        tl.to([c.wand, r.hands[1]], { y: -10, duration: 0.15 }, t)
          .to(c.wand, { rotation: -55, duration: 0.15 }, t)
          .to(r.body, { rotation: -7, svgOrigin: '53 65', duration: 0.15 }, t)
          .to(c.wand, { rotation: 20, duration: 0.15, ease: 'power2.in' }, t + 0.15)
          .to(r.body, { rotation: 5, duration: 0.15, ease: 'power2.in' }, t + 0.15)
          .to([c.wand, r.hands[1]], { y: 0, duration: 0.2 }, t + 0.3)
          .call(sfx.chime, [], t + 0.25);
        burst(tl, c.sparkles, t + 0.3, { spread: 22 + i * 12 });
      }
      tl.to(r.body, { rotation: 0, duration: 0.2 }, 2.6)
        .to(r.group, { y: -30, duration: 0.22, yoyo: true, repeat: 1, ease: 'power2.out' }, 2.7);
      burst(tl, c.sparkles, 2.8, { spread: 50 });
      takeOff(tl, [c.wizHat, c.wand], 3.5);
      return tl;
    },
  },

  astronaut: {
    label: '太空漫步', group: 'costume', weight: 0.6, svg: 'walk',
    run() {
      const r = svgs.walk.rig;
      const c = r.costume;
      const tl = gsap.timeline();
      wear(tl, c.helmet);
      tl.call(sfx.blip, [], 0.2)
        .to(r.group, { y: -60, duration: 1.4, ease: 'sine.inOut' }, 0.3)
        .to(r.group, { keyframes: { rotation: [0, 16, -12, 18, 0] }, svgOrigin: '53 50', duration: 3.4, ease: 'sine.inOut' }, 0.3)
        .to(r.legs, { rotation: (i) => (i % 2 ? 14 : -14), transformOrigin: '50% 57%', duration: 0.8, yoyo: true, repeat: 3, ease: 'sine.inOut' }, 0.4)
        .to(r.hands, { y: (i) => (i ? -14 : 10), duration: 0.8, yoyo: true, repeat: 3, ease: 'sine.inOut' }, 0.4)
        .call(sfx.blip, [], 1.8)
        .call(sfx.blip, [], 3.0)
        .to(r.group, { y: 0, duration: 1.3, ease: 'sine.in' }, 2.6)
        .call(sfx.thud, [1], 3.9)
        .to(r.body, { scaleY: 0.78, scaleX: 1.12, svgOrigin: '53 65', duration: 0.08, yoyo: true, repeat: 1 }, 3.9);
      takeOff(tl, c.helmet, 4.3);
      return tl;
    },
  },

  party: {
    label: '庆祝', group: 'costume', weight: 0.6, svg: 'walk',
    run() {
      const r = svgs.walk.rig;
      const c = r.costume;
      const tl = gsap.timeline();
      wear(tl, c.fuse);
      swapEyes(tl, r, c.happyEyes);
      // sparkles fizz from the top of the fuse (fine cell 16, -4) rather than the wand tip
      const fx = (16 - 33) * M;
      const fy = (-5 - 7) * M;
      for (let i = 0; i < 8; i++) burst(tl, c.sparkles, 0.1 + i * 0.35, { dx: fx, dy: fy, spread: 16, arc: [-Math.PI, 0] });
      [0.4, 1.4, 2.2].forEach((t, i) => {
        tl.call(sfx.toot, [], t)
          .to(r.hands, { y: -20, duration: 0.12 }, t)
          .to(r.body, { scaleY: 1.12, scaleX: 0.94, svgOrigin: '53 65', duration: 0.12 }, t)
          .to(r.group, { y: -40 - i * 8, duration: 0.22, ease: 'power2.out' }, t)
          .to(r.group, { y: 0, duration: 0.2, ease: 'power2.in' }, t + 0.22)
          .to(r.body, { scaleY: 0.82, scaleX: 1.1, duration: 0.06 }, t + 0.42)
          .to(r.body, { scaleY: 1, scaleX: 1, duration: 0.2, ease: 'back.out(3)' }, t + 0.48)
          .to(r.hands, { y: 0, duration: 0.2 }, t + 0.42);
      });
      burst(tl, c.sparkles, 2.5, { dx: fx, dy: fy, spread: 48, arc: [-Math.PI, 0] });
      takeOff(tl, c.fuse, 3.1);
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
        .fromTo(c.glasses, { y: -90 }, { y: 0, duration: 0.55, ease: 'power2.in' }, 0.2)
        .set(r.eyes, { opacity: 0 }, 0.75)
        .call(sfx.thunk, [], 0.75)
        .to(r.body, { y: 6, scaleY: 0.86, svgOrigin: '53 65', duration: 0.06, yoyo: true, repeat: 1 }, 0.75)
        .to(r.body, { y: 3, rotation: 6, duration: 0.3, yoyo: true, repeat: 3, ease: 'sine.inOut' }, 1.1)
        .to(r.hands, { y: (i) => (i ? -16 : 6), duration: 0.3, yoyo: true, repeat: 3, ease: 'sine.inOut' }, 1.1)
        .to(c.glasses, { y: -30, attr: { opacity: 0 }, duration: 0.3, ease: 'power1.in' }, 3.0)
        .set(r.eyes, { opacity: 1 }, 3.0);
      return tl;
    },
  },
};
