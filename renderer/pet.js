/* global gsap */
// Clawd desktop pet. Each animation is one of the raw SVGs in assets/raw, stacked in #pet;
// an action shows its SVG, plays a finite GSAP timeline, and the pet falls back to idle.

// One art pixel (a third of a big Clawd pixel, 10.625 / 3 SVG units) is PIXEL screen px.
const PIXEL = 4;
const SCALE = PIXEL / (10.625 / 3); // SVG units -> screen px

// Window moves are queued and applied by the pixel renderer on its beat, in whole pixels.
const winPos = { pending: null };
const queuePos = (x, y) => { winPos.pending = [x, y]; };

const SVG_FILES = {
  walk: 'walk',     // rest pose rig, used by idle / look / walk / jump / sleep (tweened)
  flag: 'anim-28',  // 12 flag sprites in the right hand
  gym: 'anim-30',   // 36 frame illustrations
  stomp: 'anim-31', // 8 stomp frames + 2 confetti bursts of 8 sprites
};

const params = new URLSearchParams(location.search);
const state = {
  auto: !params.get('action'),
  dragging: false,
  current: null, // { name, tl, done }
  idle: [],
  nextTimer: null,
  combo: 0, // poke combo level, 1-5
  lastPoke: 0,
  paused: false, // hidden behind a fullscreen app: no actions, no sound
  standStill: readSetting('clawd-stand-still') === 'on', // "挨打要立正": take pokes without dodging
};

function readSetting(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function writeSetting(key, value) {
  try { localStorage.setItem(key, value); } catch { /* storage unavailable */ }
}

const petEl = document.getElementById('pet');
const svgs = {};
const q = (root, id) => root.querySelector(`[id="${id}"]`);
const rand = (a, b) => a + Math.random() * (b - a);
const range = (a, b) => Array.from({ length: b - a }, (_, i) => a + i);

// ---------- setup ----------

function mount(key, markup) {
  petEl.insertAdjacentHTML('beforeend', markup);
  const svg = petEl.lastElementChild;
  svg.removeAttribute('class');
  const [, , w, h] = svg.getAttribute('viewBox').split(/\s+/).map(Number);
  svg.setAttribute('width', w * SCALE);
  svg.setAttribute('height', h * SCALE);
  // Place the drawing so its pixel grid lines up with the screen's art-pixel grid. The walk rig's
  // grid starts at x = -10.25 (the left arm of the official 12x8 sprite); the others at 0.
  const W = window.innerWidth;
  const H = window.innerHeight;
  const gx = key === 'walk' ? -10.25 * SCALE : 0;
  const x0 = Math.round((W / 2 - (w * SCALE) / 2 + gx) / PIXEL) * PIXEL - gx;
  const y0 = Math.round((H - 4 - h * SCALE) / PIXEL) * PIXEL;
  svg.dataset.x0 = x0;
  svg.dataset.y0 = y0;
  svg.style.left = `${x0 - W / 2}px`;
  svg.style.bottom = `${H - 4 - (y0 + h * SCALE)}px`;
  svg.dataset.key = key;
  svgs[key] = svg;
  return svg;
}

// A hidden <g> of square pixels, for extra expressions drawn on top of the rig.
function pixelGroup(parent, cells, size, fill) {
  const NS = 'http://www.w3.org/2000/svg';
  const g = document.createElementNS(NS, 'g');
  for (const [x, y] of cells) {
    const r = document.createElementNS(NS, 'rect');
    r.setAttribute('x', x);
    r.setAttribute('y', y);
    r.setAttribute('width', size);
    r.setAttribute('height', size);
    r.setAttribute('fill', fill);
    g.appendChild(r);
  }
  g.setAttribute('opacity', 0);
  parent.appendChild(g);
  return g;
}

const X_CELLS = [[0, 0], [6, 0], [3, 3], [0, 6], [6, 6]];
const Z_CELLS = [[0, 0], [1, 0], [2, 0], [2, 1], [1, 2], [0, 3], [0, 4], [1, 4], [2, 4]];
const STAR_CELLS = [[2, 0], [0, 2], [2, 2], [4, 2], [2, 4]];
const shift = (cells, dx, dy) => cells.map(([x, y]) => [x + dx, y + dy]);

function buildRigs() {
  const W = svgs.walk;
  const body = q(W, 'body');
  W.rig = {
    // > < squeezed eyes, X X dizzy eyes, and two orbiting stars
    squint: pixelSprite(body, { mx: 3, my: 2, rows: [
      'K..............K', '.K............K.', '..K..........K..', '.K............K.', 'K..............K'].map((r) => r.slice(0, 3) + '.'.repeat(12) + r.slice(-3)) }),
    dizzyEyes: pixelSprite(body, { mx: 3, my: 3, rows: ['K.K............K.K', '.K..............K.', 'K.K............K.K'] }),
    closedEyes: pixelSprite(body, { mx: 3, my: 4, rows: ['KKK............KKK'] }),
    stars: [0, 1].map(() => pixelGroup(q(W, 'Group 2'), STAR_CELLS.map(([x, y]) => [x * M / 2, y * M / 2]), M, '#F2C94C')),
    group: q(W, 'Group 2'),
    body: q(W, 'body'),
    eyes: q(W, 'body').querySelector('g'),
    eyeRects: [...q(W, 'body').querySelector('g').querySelectorAll('rect')],
    legs: [...W.querySelectorAll('[id^="leg"]')], // markup order: leg4, leg3, leg2, leg1
    hands: [q(W, 'left-hand'), q(W, 'right-hand')],
    // pixel "z"s for sleeping
    zs: [0, 1, 2].map(() => pixelGroup(W, Z_CELLS.map(([x, y]) => [92 + x * M, -6 + y * M]), M, '#DD775B')),
  };

  // Legs are full width and reach far up behind the body (top at y 30), and the whole leg
  // layer is clipped to the area below the body's bottom edge. The clip follows the body's
  // transform every frame, so however the body lifts, tilts or squashes, each leg meets it
  // edge to edge at full width: no gap, no thin strip, nothing poking out beside the body.
  const NS = 'http://www.w3.org/2000/svg';
  W.rig.legs.forEach((leg) => { leg.setAttribute('y', 30); leg.setAttribute('height', 56); });
  const below = document.createElementNS(NS, 'clipPath');
  below.id = 'below-body';
  const half = document.createElementNS(NS, 'rect');
  half.setAttribute('x', -300);
  half.setAttribute('y', 62); // 3 units above the body's bottom edge, tucked under it
  half.setAttribute('width', 700);
  half.setAttribute('height', 400);
  below.appendChild(half);
  W.rig.legClip = half;
  W.querySelector('defs').appendChild(below);
  const legLayer = W.rig.legs[0].parentNode; // the ground-clip group holding the legs
  const wrap = document.createElementNS(NS, 'g');
  wrap.setAttribute('clip-path', 'url(#below-body)');
  legLayer.parentNode.insertBefore(wrap, legLayer);
  wrap.appendChild(legLayer);
  gsap.ticker.add(() => {
    const t = W.rig.body.getAttribute('transform');
    if (t) half.setAttribute('transform', t);
    else half.removeAttribute('transform');
  });
  // Arms stick out two Clawd pixels on each side, as in the official 12x8 sprite (the Codrops
  // drawings have them one pixel short). Widen the horizontal arms everywhere they appear.
  for (const svg of [W, svgs.stomp, svgs.flag]) {
    svg.querySelectorAll('rect[id="left-hand"], rect[id="right-hand"]').forEach((hand) => {
      const w = Number(hand.getAttribute('width'));
      const h = Number(hand.getAttribute('height'));
      if (w < 20 || w > 23 || h < 20 || h > 24) return; // only the plain horizontal arm blocks
      if (svg === svgs.flag && hand.id === 'right-hand') return; // holds the flag pole
      if (hand.id === 'left-hand') hand.setAttribute('x', Number(hand.getAttribute('x') || 0) - 10.25);
      hand.setAttribute('width', w + 10.25);
    });
  }

  const F = svgs.flag;
  const inner = F.querySelector(':scope > g');
  const handGroup = [...inner.children].find(el => el.tagName === 'g' && !el.id);
  F.rig = {
    inner,
    feet: [...F.querySelectorAll('[id^="dleg"]')],
    handGroup,
    leftHand: q(inner, 'left-hand'),
    frames: [...handGroup.querySelectorAll(':scope > g')],
  };

  const G = svgs.gym;
  G.rig = { frames: [...G.children].filter(el => el.tagName === 'g') };

  const S = svgs.stomp;
  const top = [...S.children].filter(el => el.tagName === 'g');
  S.rig = {
    frames: top.filter(el => /^l\d+$/.test(el.id)),
    bursts: top.filter(el => !el.id).map(b => ({ el: b, sprites: [...b.querySelectorAll(':scope > g')] })),
  };
}

function show(key) {
  for (const svg of Object.values(svgs)) svg.classList.toggle('active', svg.dataset.key === key);
}

function showFrame(frames, idx) {
  frames.forEach((f, i) => { f.style.display = i === idx ? 'inline' : 'none'; });
}

function resetWalkRig() {
  const r = svgs.walk.rig;
  gsap.killTweensOf(petEl);
  gsap.set(petEl, { clearProps: 'transform' });
  gsap.killTweensOf([r.group, r.body, r.eyes, ...r.eyeRects, ...r.legs, ...r.hands, ...r.zs, ...r.stars]);
  gsap.set([r.group, r.body, r.eyes, ...r.eyeRects, ...r.legs, ...r.hands], { clearProps: 'all' });
  gsap.set([...r.zs, ...r.stars], { clearProps: 'all' });
  [...r.zs, ...r.stars, r.squint, r.dizzyEyes, r.closedEyes].forEach(el => el.setAttribute('opacity', 0));
  if (r.costumeParts) {
    gsap.killTweensOf(r.costumeParts);
    gsap.set(r.costumeParts, { clearProps: 'all' });
    r.costumeParts.forEach(el => el.setAttribute('opacity', 0));
  }
}

// ---------- idle (always running between actions) ----------

function startIdle() {
  stopIdle();
  show('walk');
  const r = svgs.walk.rig;
  state.idle.push(gsap.to(r.body, { y: M, duration: 0.9, ease: 'steps(1)', yoyo: true, repeat: -1, repeatDelay: 0.3 }));
  const blink = () => {
    const twice = Math.random() < 0.25;
    const blinkTl = gsap.timeline();
    [0, 0.3].slice(0, twice ? 2 : 1).forEach((t) => {
      blinkTl.set(r.eyes, { opacity: 0 }, t).set(r.closedEyes, { attr: { opacity: 1 } }, t)
        .set(r.eyes, { opacity: 1 }, t + 0.15).set(r.closedEyes, { attr: { opacity: 0 } }, t + 0.15);
    });
    state.idle.push(blinkTl, gsap.delayedCall(rand(2, 5), blink));
  };
  const glance = () => {
    gsap.to(r.eyes, { x: [-2, 0, 2][Math.floor(Math.random() * 3)], duration: 0.15, ease: 'power2.out' });
    state.idle.push(gsap.delayedCall(rand(3, 7), glance));
  };
  state.idle.push(gsap.delayedCall(rand(1, 3), blink), gsap.delayedCall(rand(2, 4), glance));
}

function stopIdle() {
  state.idle.forEach(t => t.kill());
  state.idle = [];
  resetWalkRig();
}

// ---------- actions ----------
// run({ b, ...opts }) synchronously returns a finite gsap timeline; b is the window bounds
// (null outside Electron). Add new actions here.

async function windowBounds() {
  return window.pet ? window.pet.getBounds() : null;
}

// Tween the OS window horizontally inside the timeline.
function moveWindow(tl, b, targetX, duration, ease, at) {
  if (!b) return;
  const proxy = { x: b.x };
  tl.to(proxy, { x: targetX, duration, ease, onUpdate: () => queuePos(proxy.x, b.y) }, at);
}

function clampX(b, x) {
  const min = b.area.x - 60;
  const max = b.area.x + b.area.width - b.w + 60;
  return Math.max(min, Math.min(max, x));
}

// Poke while "挨打要立正" is on: Clawd stands to attention and takes it. No knockback, no
// bounce, no falling over; a combo of 3+ still leaves it seeing stars, upright.
function pokeStanding(k) {
  const r = svgs.walk.rig;
  const orbit = { a: 0 };
  const tl = gsap.timeline();
  tl.call(sfx.bonk, [k], 0)
    .set(r.eyes, { opacity: 0 }, 0)
    .set(r.squint, { attr: { opacity: 1 } }, 0)
    .to(r.hands, { y: 3, duration: 0.05 }, 0)
    .to(r.body, { scaleX: 1.08, scaleY: 0.88, svgOrigin: '53 65', duration: 0.05, ease: 'power2.out' }, 0)
    .to(r.body, { scaleX: 1, scaleY: 1, duration: 0.4, ease: 'elastic.out(1, 0.45)' }, 0.05);
  if (k < 3) {
    tl.set(r.squint, { attr: { opacity: 0 } }, 0.6).set(r.eyes, { opacity: 1 }, 0.6).to(r.hands, { y: 0, duration: 0.2 }, 0.6);
    return tl;
  }
  const hold = 1.2 + 0.3 * k;
  tl.call(sfx.dizzy, [k], 0.35)
    .set(r.squint, { attr: { opacity: 0 } }, 0.35)
    .set([r.dizzyEyes, ...r.stars], { attr: { opacity: 1 } }, 0.35)
    .to(r.body, { keyframes: { rotation: [0, -3, 3, -2, 2, 0] }, svgOrigin: '53 65', duration: hold, ease: 'sine.inOut' }, 0.35)
    .to(orbit, {
      a: Math.PI * 2 * hold, duration: hold, ease: 'none',
      onUpdate: () => r.stars.forEach((s, i) => {
        const a = orbit.a + i * Math.PI;
        gsap.set(s, { x: 50 + Math.cos(a) * 28, y: -8 + Math.sin(a) * 6 });
      }),
    }, 0.35)
    .call(sfx.recover, [k], 0.35 + hold)
    .set([r.dizzyEyes, ...r.stars], { attr: { opacity: 0 } }, 0.35 + hold)
    .set(r.eyes, { opacity: 1 }, 0.35 + hold)
    .to(r.hands, { y: 0, duration: 0.2 }, 0.35 + hold);
  return tl;
}

const actions = {
  look: {
    label: '左右张望', weight: 3, svg: 'walk',
    run() {
      const r = svgs.walk.rig;
      const tl = gsap.timeline();
      const lean = (dir) => {
        tl.to(r.eyes, { x: 4 * dir, duration: 0.4, ease: 'power2.out' })
          .to(r.body, { rotation: 8 * dir, x: 7 * dir, y: -8, svgOrigin: '53 65', duration: 0.4, ease: 'back.out(2)' }, '<')
          .to(r.hands, { y: (i) => ((i === 0) === (dir < 0) ? -10 : 6), duration: 0.4, ease: 'back.out(2)' }, '<')
          .to(r.legs, {
            // legs lean into it and stretch enough that their tops stay tucked under the lifted body
            rotation: i => (dir < 0 ? [-9, -10, -11, -12] : [12, 11, 10, 9])[i],
            scaleY: i => (dir < 0 ? [1.32, 1.36, 1.42, 1.48] : [1.48, 1.42, 1.36, 1.32])[i],
            transformOrigin: '50% 100%', duration: 0.4, ease: 'power2.out',
          }, '<')
          .to({}, { duration: 0.9 });
      };
      const back = () => {
        tl.to(r.eyes, { x: 0, duration: 0.3, ease: 'power2.inOut' })
          .to(r.body, { rotation: 0, x: 0, y: 0, svgOrigin: '53 65', duration: 0.3, ease: 'power2.inOut' }, '<')
          .to(r.hands, { y: 0, duration: 0.3 }, '<')
          .to(r.legs, { rotation: 0, scaleY: 1, duration: 0.3, ease: 'power2.inOut' }, '<');
      };
      const first = Math.random() < 0.5 ? -1 : 1;
      lean(first); back(); tl.to({}, { duration: 0.2 }); lean(-first); back();
      return tl;
    },
  },

  walk: {
    label: '散步', weight: 3, svg: 'walk',
    run({ b }) {
      const r = svgs.walk.rig;
      let dir = Math.random() < 0.5 ? -1 : 1;
      const dist = rand(150, 380);
      let target = b ? clampX(b, b.x + dir * dist) : 0;
      if (b && Math.abs(target - b.x) < 60) { dir = -dir; target = clampX(b, b.x + dir * dist); }
      const travel = b ? Math.abs(target - b.x) : dist;
      const duration = travel / 110;
      const step = 0.13;
      const steps = Math.max(2, Math.round(duration / step));
      const pairA = [r.legs[0], r.legs[2]];
      const pairB = [r.legs[1], r.legs[3]];

      const tl = gsap.timeline();
      tl.to(r.eyes, { x: 3 * dir, duration: 0.2, ease: 'power2.out' });
      tl.addLabel('go');
      for (let i = 0; i < steps; i++) {
        const [up, down] = i % 2 ? [pairA, pairB] : [pairB, pairA];
        // waddle: legs lift high, body bobs and rocks, arms swing
        tl.set(up, { y: -10 }, `go+=${i * step}`)
          .set(down, { y: 0 }, '<')
          .to(r.body, { y: -4, rotation: (i % 2 ? 4 : -4) + 3 * dir, svgOrigin: '53 65', duration: step / 2, ease: 'power1.out' }, `go+=${i * step}`)
          .to(r.body, { y: 0, duration: step / 2, ease: 'power1.in' }, `go+=${i * step + step / 2}`)
          .to(r.hands, { y: (h) => ((h + i) % 2 ? -5 : 4), duration: step }, `go+=${i * step}`);
      }
      tl.set(r.legs, { y: 0 }, `go+=${steps * step}`)
        .to(r.body, { y: 0, rotation: 0, duration: 0.15 }, `go+=${steps * step}`)
        .to(r.hands, { y: 0, duration: 0.15 }, '<');
      moveWindow(tl, b, target, steps * step, 'none', 'go');
      tl.to(r.eyes, { x: 0, duration: 0.3 }, '+=0.3');
      return tl;
    },
  },

  jump: {
    label: '跳一下', weight: 2, svg: 'walk',
    run({ b }) {
      const r = svgs.walk.rig;
      let dir = Math.random() < 0.5 ? -1 : 1;
      if (b && Math.abs(clampX(b, b.x + dir * 150) - b.x) < 50) dir = -dir; // at a screen edge, hop back inward
      const tl = gsap.timeline();
      tl.to(r.body, { y: 14, scaleX: 1.12, scaleY: 0.86, svgOrigin: '53 65', duration: 0.14, ease: 'power3.in' })
        .to(r.hands, { y: 14, duration: 0.14, ease: 'power3.in' }, '<')
        .to(r.legs, { scaleY: 0.55, transformOrigin: '50% 100%', duration: 0.14, ease: 'power3.in' }, '<')
        .addLabel('jump', '+=0.08')
        .to(r.body, { y: -6, scaleX: 0.91, scaleY: 1.2, duration: 0.15, ease: 'power2.out' }, 'jump')
        .to(r.hands, { y: -16, duration: 0.15, ease: 'power2.out' }, 'jump')
        .to(r.legs, { scaleY: 1, y: 4, duration: 0.15 }, 'jump') // dangle a little; never switch origin
        .to(r.group, { y: -95, duration: 0.45, ease: 'sine.out' }, 'jump')
        .to(r.body, { y: 0, scaleX: 1, scaleY: 1, duration: 0.2 }, 'jump+=0.12')
        .to(r.group, { rotation: 360 * dir, svgOrigin: '53 45', duration: 0.55, ease: 'steps(4)' }, 'jump+=0.12') // whole-body flip in quarter turns
        .to(r.group, { y: 0, duration: 0.24, ease: 'power3.in' }, 'jump+=0.66')
        .to(r.legs, { y: 0, duration: 0.2 }, 'jump+=0.66')
        .set(r.group, { rotation: 0 }, 'jump+=0.9')
        .to(r.body, { y: 10, scaleX: 1.2, scaleY: 0.72, duration: 0.06 }, 'jump+=0.9')
        .to(r.hands, { y: 10, duration: 0.06 }, 'jump+=0.9')
        .to(r.body, { y: 0, scaleX: 1, scaleY: 1, duration: 0.45, ease: 'elastic.out(1, 0.4)' }, 'jump+=0.96')
        .to(r.hands, { y: 0, duration: 0.25 }, 'jump+=0.96');
      if (b) moveWindow(tl, b, clampX(b, b.x + dir * 150), 0.9, 'power1.inOut', 'jump');
      return tl;
    },
  },

  stomp: {
    label: '撒彩带', weight: 1, svg: 'stomp',
    run() {
      const { frames, bursts } = svgs.stomp.rig;
      const FRAME = 0.125;
      const yOff = [-65, -72, -76, -70, -58, -42, -22, 0];
      bursts.forEach(b => { b.el.style.display = 'none'; });
      const tl = gsap.timeline();
      for (let beat = 0; beat < 24; beat++) {
        tl.call(showFrame, [frames, beat % 8], beat * FRAME);
        if (beat % 2 === 0) {
          tl.to(petEl, { scaleY: 0.86, scaleX: 1.1, transformOrigin: '0px 0px', duration: 0.05 }, beat * FRAME)
            .to(petEl, { scaleY: 1.1, scaleX: 0.94, duration: 0.07 }, beat * FRAME + 0.05)
            .to(petEl, { scaleY: 1, scaleX: 1, duration: 0.1 }, beat * FRAME + 0.12);
        }
      }
      const fire = (burst, mirror, startBeat) => {
        for (let k = 0; k < 8; k++) {
          tl.call(() => {
            burst.el.style.display = 'inline';
            showFrame(burst.sprites, k);
            const x = mirror ? 41 : 88;
            burst.el.setAttribute('transform', `translate(${x} ${30 + yOff[k]})${mirror ? ' scale(-1 1)' : ''}`);
          }, null, (startBeat + k) * FRAME);
        }
        tl.call(() => { burst.el.style.display = 'none'; }, null, (startBeat + 8) * FRAME);
      };
      [1, 9].forEach(s => fire(bursts[0], false, s));
      [6, 14].forEach(s => fire(bursts[1] || bursts[0], true, s));
      tl.call(showFrame, [frames, 0], 24 * FRAME);
      return tl;
    },
  },

  flag: {
    label: '挥旗', weight: 1, svg: 'flag',
    run() {
      const { inner, feet, handGroup, leftHand, frames } = svgs.flag.rig;
      const FRAME = 0.1;
      const handExtraX = [0, -6, -12, -14, -8, -2, 0, 0, -4, -10, -16, -18];
      const swayX = [0, 0, -5, -5, 0, 4, 4, 4, 0, 0, -5, -5];
      const leftHandY = [0, 0, 4, 4, 0, 0, 0, 0, 0, 0, 4, 4];
      // First pass raises the flag (frames 0-2), later passes loop from frame 3.
      const order = [...range(0, 12), ...range(3, 12), ...range(3, 12), ...range(3, 12)];
      gsap.set([handGroup, inner, leftHand, ...feet], { clearProps: 'all' });
      const tl = gsap.timeline();
      order.forEach((f, i) => {
        const t = i * FRAME;
        tl.call(showFrame, [frames, f], t)
          .to(petEl, { rotation: -swayX[f] * 1.2, transformOrigin: '0px 0px', duration: FRAME }, t)
          .set(handGroup, { x: handExtraX[f] }, t)
          .set([inner, ...feet], { x: swayX[f] }, t)
          .set(leftHand, { y: leftHandY[f] }, t);
      });
      tl.call(showFrame, [frames, 0], order.length * FRAME)
        .set([handGroup, inner, leftHand, ...feet], { clearProps: 'all' });
      return tl;
    },
  },

  gym: {
    label: '健身', weight: 1, svg: 'gym',
    run() {
      const { frames } = svgs.gym.rig;
      // 36 drawings, 48 beats: frames 12-23 play twice for the second rep.
      const seq = [...range(0, 24), ...range(12, 24), ...range(24, 36)];
      const delay = (i, f) => {
        if (i === seq.length - 1) return 1.5;
        if (f === 6 || f === 7) return 0.27;
        if (f === 15 || f === 21) return 0.4;
        return 0.085;
      };
      const tl = gsap.timeline();
      let t = 0;
      seq.forEach((f, i) => {
        tl.call(showFrame, [frames, f], t);
        // strain on the effort frames
        if (f === 6 || f === 15 || f === 21) {
          tl.to(petEl, { scaleY: 0.88, scaleX: 1.08, transformOrigin: '0px 0px', duration: 0.08 }, t)
            .to(petEl, { keyframes: { x: [-3, 3, -2, 2, 0] }, duration: 0.25 }, t)
            .to(petEl, { scaleY: 1, scaleX: 1, duration: 0.2, ease: 'back.out(3)' }, t + 0.25);
        }
        t += delay(i, f);
      });
      tl.call(showFrame, [frames, 0], t);
      return tl;
    },
  },

  // ----- poke reaction (weight 0: only from clicks or the menu) -----
  // One sequence: get hit -> bounce up -> land -> faint (X eyes, stars) -> shake it off.
  // Every click restarts it; k (1-5) grows with quick repeated clicks: higher bounce,
  // longer faint, higher-pitched sounds.

  poke: {
    label: '捉弄一下', weight: 0, svg: 'walk',
    run({ b, dir, k = 1 }) {
      if (state.standStill) return pokeStanding(k);
      const r = svgs.walk.rig;
      const away = dir || (Math.random() < 0.5 ? -1 : 1);
      const jumpH = 55 + 9 * k;
      const hold = Math.min(1.6 + 0.35 * k, 3.2);
      const orbit = { a: 0 };
      const tl = gsap.timeline();

      // hit
      tl.call(sfx.bonk, [k], 0)
        .set(r.eyes, { opacity: 0 }, 0)
        .set(r.squint, { attr: { opacity: 1 } }, 0)
        .to(r.body, { scaleX: 1.22, scaleY: 0.7, rotation: 8 * away, svgOrigin: '53 65', duration: 0.06, ease: 'power2.out' }, 0)
        .to(r.hands, { y: -16, duration: 0.06 }, 0)
        .to(r.legs, { scaleY: 0.75, transformOrigin: '50% 100%', duration: 0.06 }, 0)
        .to(r.group, { keyframes: { x: [13 * away, -9 * away, 7 * away, -4 * away, 0] }, duration: 0.26, ease: 'none' }, 0.06);
      if (b) moveWindow(tl, b, clampX(b, b.x + away * (30 + 8 * k)), 0.3, 'power2.out', 0.04);

      // bounce
      tl.addLabel('bounce', 0.32)
        .call(sfx.boing, [k], 'bounce')
        .to(r.body, { scaleX: 0.91, scaleY: 1.18, rotation: 0, duration: 0.1 }, 'bounce')
        .to(r.group, { rotation: -14 * away, svgOrigin: '53 50', duration: 0.28, ease: 'power2.out' }, 'bounce')
        .to(r.group, { rotation: 0, duration: 0.2, ease: 'power2.in' }, 'bounce+=0.34')
        .to(r.group, { y: -jumpH, duration: 0.28, ease: 'power2.out' }, 'bounce')
        .to(r.legs, { scaleY: 1, y: 3, duration: 0.12 }, 'bounce')
        .to(r.hands, { y: -14, duration: 0.12 }, 'bounce')
        .to(r.group, { y: 0, duration: 0.2, ease: 'power2.in' }, 'bounce+=0.34')
        .to(r.legs, { y: 0, duration: 0.15 }, 'bounce+=0.34')
        .addLabel('land', 'bounce+=0.54')
        .call(sfx.thud, [k], 'land')
        .to(r.body, { scaleX: 1.24, scaleY: 0.68, rotation: 0, duration: 0.06 }, 'land')
        .to(r.hands, { y: 4, duration: 0.06 }, 'land');

      // faint
      tl.addLabel('faint', 'land+=0.12')
        .call(sfx.dizzy, [k], 'faint')
        .set(r.squint, { attr: { opacity: 0 } }, 'faint')
        .set([r.dizzyEyes, ...r.stars], { attr: { opacity: 1 } }, 'faint')
        .to(r.body, { scaleX: 1, scaleY: 1, y: 3, duration: 0.2 }, 'faint')
        .set(r.group, { svgOrigin: away > 0 ? '11 86' : '96 86' }, 'faint')
        .to(r.group, { rotation: -16 * away, duration: 0.4, ease: 'bounce.out' }, 'faint')
        .to(r.legs, { scaleY: 1, duration: 0.2 }, 'faint')
        .to(r.hands, { y: 9, duration: 0.35 }, 'faint')
        .to(r.group, { keyframes: { rotation: [-16 * away, -7 * away, -16 * away, -8 * away, -16 * away] }, duration: hold, ease: 'sine.inOut' }, 'faint+=0.4')
        .to(orbit, {
          a: Math.PI * 2 * hold, duration: hold + 0.35, ease: 'none',
          onUpdate: () => r.stars.forEach((s, i) => {
            const a = orbit.a + i * Math.PI;
            gsap.set(s, { x: 50 + Math.cos(a) * 28, y: -8 + Math.sin(a) * 6 });
          }),
        }, 'faint');

      // shake it off
      tl.addLabel('recover', `faint+=${hold + 0.35}`)
        .call(sfx.recover, [k], 'recover')
        .set(r.stars, { attr: { opacity: 0 } }, 'recover')
        .to(r.group, { keyframes: { x: [-8, 8, -6, 6, -3, 0] }, duration: 0.35 }, 'recover')
        .to(r.group, { rotation: 0, duration: 0.5, ease: 'elastic.out(1, 0.5)' }, 'recover')
        .to(r.body, { y: 0, duration: 0.3 }, 'recover')
        .to(r.legs, { scaleY: 1, duration: 0.3, ease: 'back.out(2)' }, 'recover')
        .to(r.hands, { y: 0, duration: 0.3 }, 'recover')
        .set(r.dizzyEyes, { attr: { opacity: 0 } }, 'recover+=0.3')
        .set(r.eyes, { opacity: 1 }, 'recover+=0.3');
      return tl;
    },
  },

  sleep: {
    label: '睡觉', weight: 1, svg: 'walk',
    run() {
      const r = svgs.walk.rig;
      const tl = gsap.timeline();
      tl.set(r.eyes, { opacity: 0 }, 0.3).set(r.closedEyes, { attr: { opacity: 1 } }, 0.3)
        .to(r.eyes, { duration: 0.5 }, 0)
        .to(r.body, { y: 3, duration: 0.6, ease: 'sine.inOut' }, '<')
        .to(r.hands, { y: 3, duration: 0.6, ease: 'sine.inOut' }, '<')
        .addLabel('zz')
        .to(r.body, { y: 5, duration: 1.4, ease: 'sine.inOut', yoyo: true, repeat: 7 }, 'zz');
      r.zs.forEach((z, i) => {
        tl.fromTo(z, { x: 0, y: 0, attr: { opacity: 0 } }, {
          keyframes: [
            { attr: { opacity: 1 }, x: 4, y: -10, duration: 0.6 },
            { attr: { opacity: 0 }, x: 12, y: -32, duration: 1.2 },
          ],
          ease: 'none', repeat: 5, repeatDelay: 0.6,
        }, `zz+=${i * 0.8}`);
      });
      tl.set(r.closedEyes, { attr: { opacity: 0 } }, 'zz+=11.5').set(r.eyes, { opacity: 1 }, 'zz+=11.5')
        .to([r.body, r.hands], { y: 0, duration: 0.2, ease: 'back.out(3)' }, '<');
      return tl;
    },
  },

  ...costumeActions, // renderer/costumes.js
};

// ---------- runner / scheduler ----------

// Every start or interrupt bumps runId, so a stale action never restarts idle under a newer one.
function interrupt() {
  state.runId = (state.runId || 0) + 1;
  if (state.current) state.current.tl.kill();
  state.current = null;
  sfx.stopAll();
}

async function runAction(name, opts = {}) {
  const def = actions[name];
  if (!def) return;
  clearTimeout(state.nextTimer);
  interrupt();
  if (follow.running) { follow.tweens.forEach((t) => t.kill()); follow.tweens = []; follow.running = false; }
  const id = state.runId;
  stopIdle();
  show(def.svg);
  const b = await windowBounds();
  if (id !== state.runId) return;
  // run() must stay synchronous: gsap timelines are thenables, so awaiting one (or returning it
  // from an async function) waits for the whole animation and misses its onComplete.
  const tl = def.run({ ...opts, b });
  state.current = { name, tl };
  await new Promise((done) => tl.eventCallback('onComplete', done));
  if (id !== state.runId) return;
  state.current = null;
  if (!state.dragging) { startIdle(); scheduleNext(); }
}

function pickAction() {
  const list = Object.entries(actions);
  let n = Math.random() * list.reduce((s, [, a]) => s + a.weight, 0);
  for (const [name, a] of list) { if ((n -= a.weight) < 0) return name; }
  return list[0][0];
}

function scheduleNext() {
  clearTimeout(state.nextTimer);
  if (!state.auto || follow.on || state.paused) return; // no random actions while chasing the cursor or hidden
  state.nextTimer = setTimeout(() => {
    if (!state.current && !state.dragging) runAction(pickAction());
  }, rand(6000, 14000));
}

// ---------- follow the mouse ----------
// When on, Clawd runs after the cursor (anywhere on screen) and stops a little to one side of
// it, then just watches it. Pokes and drags still work; random actions pause.

const follow = {
  on: readSetting('clawd-follow') === 'on',
  running: false,
  dir: 0,
  tweens: [],
  busy: false,
  last: 0,
};
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function clampY(b, y) {
  return clamp(y, b.area.y - 40, b.area.y + b.area.height - b.h);
}

function startRun(dir) {
  if (follow.running && follow.dir === dir) return;
  const r = svgs.walk.rig;
  if (!follow.running) stopIdle();
  follow.tweens.forEach((t) => t.kill());
  follow.running = true;
  follow.dir = dir;
  show('walk');
  const pairA = [r.legs[0], r.legs[2]];
  const pairB = [r.legs[1], r.legs[3]];
  const cycle = gsap.timeline({ repeat: -1 });
  cycle.set(pairA, { y: -12 }, 0).set(pairB, { y: 0 }, 0)
    .to(r.body, { y: -6, duration: 0.05, ease: 'power1.out' }, 0)
    .to(r.body, { y: 0, duration: 0.05, ease: 'power1.in' }, 0.05)
    .to(r.hands, { y: (h) => (h ? -8 : 6), duration: 0.1 }, 0)
    .set(pairA, { y: 0 }, 0.1).set(pairB, { y: -12 }, 0.1)
    .to(r.body, { y: -6, duration: 0.05, ease: 'power1.out' }, 0.1)
    .to(r.body, { y: 0, duration: 0.05, ease: 'power1.in' }, 0.15)
    .to(r.hands, { y: (h) => (h ? 6 : -8), duration: 0.1 }, 0.1);
  follow.tweens = [
    cycle,
    gsap.to(r.group, { rotation: 8 * dir, svgOrigin: '53 86', duration: 0.15 }),
    gsap.to(r.eyes, { x: 4 * dir, y: 0, duration: 0.15 }),
  ];
}

function stopRun() {
  if (!follow.running) return;
  follow.tweens.forEach((t) => t.kill());
  follow.tweens = [];
  follow.running = false;
  // skid to a stop, then idle
  const r = svgs.walk.rig;
  gsap.set(r.legs, { y: 0 });
  gsap.to(r.group, { rotation: -5 * follow.dir, svgOrigin: '53 86', duration: 0.1, yoyo: true, repeat: 1, onComplete: () => { if (!follow.running && !state.current && !state.dragging) startIdle(); } });
}

async function followTick() {
  if (!follow.on || !window.pet || state.current || state.dragging || follow.busy || state.paused) return;
  follow.busy = true;
  try {
    const { cursor, b } = await window.pet.getFollowInfo();
    if (!follow.on || state.current || state.dragging) return;
    const now = performance.now();
    const dt = Math.min(0.1, (now - follow.last) / 1000);
    follow.last = now;
    // Clawd's feet are centred at the bottom of the window. Aim to stand ~110 px beside the
    // cursor (on whichever side it is already on), feet a bit below it.
    const feetX = b.x + b.w / 2;
    const feetY = b.y + b.h - 4;
    const side = cursor.x < feetX ? 1 : -1;
    const dx = cursor.x + side * 110 - feetX;
    const dy = cursor.y + 70 - feetY;
    const d = Math.hypot(dx, dy);
    if (d > (follow.running ? 12 : 45)) {
      const step = Math.min(d, 300 * dt);
      queuePos(clampX(b, b.x + (dx / d) * step), clampY(b, b.y + (dy / d) * step));
      startRun(dx >= 0 ? 1 : -1);
    } else if (follow.running) {
      stopRun();
    } else {
      // watch the cursor
      const r = svgs.walk.rig;
      gsap.to(r.eyes, {
        x: clamp((cursor.x - feetX) / 30, -4, 4),
        y: clamp((cursor.y - (feetY - 110)) / 30, -3, 3),
        duration: 0.2, overwrite: 'auto',
      });
    }
  } finally {
    follow.busy = false;
  }
}
setInterval(followTick, 33);

function setFollow(on) {
  follow.on = on;
  writeSetting('clawd-follow', on ? 'on' : 'off');
  follow.last = performance.now();
  if (!on) { stopRun(); scheduleNext(); } else clearTimeout(state.nextTimer);
}

// ---------- mouse: hover pass-through, drag, click, menu ----------

let overPet = false;
function setOver(v) {
  if (v === overPet || state.dragging) return;
  overPet = v;
  if (window.pet) window.pet.setIgnoreMouse(!v);
}

const isPetAt = (x, y) => {
  const el = x >= 0 ? document.elementFromPoint(x, y) : null;
  return !!(el && el.closest('#pet svg'));
};
document.addEventListener('mousemove', (e) => setOver(isPetAt(e.clientX, e.clientY)));
document.addEventListener('mouseleave', () => setOver(false));
if (window.pet) window.pet.onCursor((x, y) => setOver(isPetAt(x, y)));

// The drag record is created synchronously on pointerdown; window bounds arrive later.
// (Awaiting them first let a quick click's pointerup land before the drag existed,
// leaving a drag nobody ended, so Clawd followed the cursor around.)
let drag = null;

function endDrag() {
  const d = drag;
  drag = null;
  if (d && d.moved) {
    state.dragging = false;
    petEl.classList.remove('dragging');
    resetWalkRig();
    startIdle();
    scheduleNext();
  }
  return d;
}

petEl.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  petEl.setPointerCapture(e.pointerId);
  const d = { sx: e.screenX, sy: e.screenY, b: null, moved: false };
  drag = d;
  windowBounds().then((b) => { d.b = b; });
});

petEl.addEventListener('pointermove', (e) => {
  if (!drag) return;
  if (!(e.buttons & 1)) { endDrag(); return; } // released where we never got the pointerup
  if (!drag.b) return;
  const dx = e.screenX - drag.sx;
  const dy = e.screenY - drag.sy;
  if (!drag.moved && Math.hypot(dx, dy) < 4) return;
  if (!drag.moved) {
    drag.moved = true;
    state.dragging = true;
    petEl.classList.add('dragging');
    clearTimeout(state.nextTimer);
    interrupt();
    if (follow.running) { follow.tweens.forEach((t) => t.kill()); follow.tweens = []; follow.running = false; }
    stopIdle();
    show('walk');
    const r = svgs.walk.rig;
    // Held up: legs dangle, hands drop.
    gsap.to(r.legs, { y: 3, rotation: (i) => (i % 2 ? 8 : -8), transformOrigin: '50% 57%', duration: 0.3, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    gsap.to(r.hands, { y: 4, duration: 0.2 });
  }
  window.pet.setPos(drag.b.x + dx, drag.b.y + dy);
});

petEl.addEventListener('pointerup', (e) => {
  if (e.button !== 0) return;
  const d = endDrag();
  if (d && !d.moved) poke(e);
});

petEl.addEventListener('lostpointercapture', () => { if (drag) endDrag(); });

// A click always gets a reaction, interrupting whatever Clawd is doing (even mid-poke).
// Clicks under 1.5 s apart build a combo: bigger bounce, longer faint, higher-pitched sounds.
function poke(e) {
  const now = Date.now();
  state.combo = now - state.lastPoke < 1500 ? Math.min(state.combo + 1, 5) : 1;
  state.lastPoke = now;
  const dir = e.clientX < window.innerWidth / 2 ? 1 : -1; // knocked away from the side you poked
  runAction('poke', { dir, k: state.combo });
}

document.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  if (!window.pet) return;
  window.pet.showMenu(
    Object.entries(actions).map(([name, a]) => ({ name, label: a.label, group: a.group || 'basic' })),
    { auto: state.auto, sound: sfx.enabled, standStill: state.standStill, follow: follow.on },
  );
});

// ---------- boot ----------

(async () => {
  const raw = window.pet ? await window.pet.loadAssets() : {};
  for (const [key, file] of Object.entries(SVG_FILES)) mount(key, raw[file]);
  buildRigs();
  buildCostumes();
  pixelView.start();
  showFrame(svgs.gym.rig.frames, 0);
  showFrame(svgs.stomp.rig.frames, 0);
  showFrame(svgs.flag.rig.frames, 0);
  svgs.stomp.rig.bursts.forEach(b => { b.el.style.display = 'none'; });

  if (window.pet) {
    window.pet.onRunAction(runAction);
    window.pet.onPause((paused) => {
      state.paused = paused;
      if (paused) {
        clearTimeout(state.nextTimer);
        interrupt();
        if (follow.running) { follow.tweens.forEach((t) => t.kill()); follow.tweens = []; follow.running = false; }
        startIdle();
      } else {
        scheduleNext();
      }
    });
    window.pet.onSetting((key, on) => {
      if (key === 'sound') sfx.enabled = on;
      if (key === 'follow') setFollow(on);
      if (key === 'standStill') { state.standStill = on; writeSetting('clawd-stand-still', on ? 'on' : 'off'); }
      if (key === 'auto') { state.auto = on; if (on && !state.current) scheduleNext(); else clearTimeout(state.nextTimer); }
    });
  }

  // Tell the main process every few seconds that the pet is alive and drawn.
  if (window.pet) setInterval(() => { if (svgs.walk && svgs.walk.isConnected) window.pet.heartbeat(); }, 4000);

  startIdle();
  const first = params.get('action');
  if (first && actions[first]) runAction(first);
  else scheduleNext();
})();
