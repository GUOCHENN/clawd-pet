/* global gsap, svgs, petEl, state, PIXEL, SCALE, PAL, winPos */
// Pixel renderer. The vector rig in #pet only drives the animation and the hit-testing and is
// itself invisible. FPS times a second the active drawing is rasterised onto a tiny canvas in
// which one pixel is one "fine" pixel of the official sprite (a third of a big Clawd pixel),
// every pixel is snapped to Clawd's palette with a hard alpha cut (no blurry edges, no
// half-transparent pixels), and the result is blown up with hard edges. Tilts and squashes come
// out as stair-stepped pixel art, motion advances in whole pixels at a pixel-game frame rate,
// and the window itself moves in pixel-sized steps on the same beat.

const FPS = 12;

// Built on first start(), so this file can load before pet.js (which defines PIXEL, SCALE, svgs).
function makePixelView() {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const LO_W = Math.round(W / PIXEL);
  const LO_H = Math.round(H / PIXEL);

  const view = document.createElement('canvas');
  view.id = 'pixels';
  document.getElementById('stage').appendChild(view);
  const dpr = window.devicePixelRatio || 1;
  view.width = Math.round(W * dpr);
  view.height = Math.round(H * dpr);
  const vctx = view.getContext('2d');
  vctx.imageSmoothingEnabled = false;

  const lo = document.createElement('canvas');
  lo.width = LO_W;
  lo.height = LO_H;
  const lctx = lo.getContext('2d', { willReadFrequently: true });

  // Rendered at SUB x the art resolution with anti-aliasing off, then each art pixel takes the
  // sample at its centre: every pixel is one exact colour and edges are clean stair steps.
  const SUB = 4;
  const hi = document.createElement('canvas');
  hi.width = LO_W * SUB;
  hi.height = LO_H * SUB;
  const hctx = hi.getContext('2d', { willReadFrequently: true });

  let palette = [];
  const xs = new XMLSerializer();

  function hexToRgb(c) {
    const ctx = lctx;
    ctx.fillStyle = '#000';
    ctx.fillStyle = c; // let the browser normalise names, rgb(), #abc
    const v = ctx.fillStyle;
    if (v[0] === '#') return [parseInt(v.slice(1, 3), 16), parseInt(v.slice(3, 5), 16), parseInt(v.slice(5, 7), 16)];
    const m = v.match(/\d+/g);
    return m ? m.slice(0, 3).map(Number) : null;
  }

  // Every colour Clawd can be made of: all fills in the drawings plus the costume palette.
  function buildPalette() {
    const seen = new Map();
    const add = (c) => {
      if (!c || c === 'none' || c.startsWith('url(')) return;
      const rgb = hexToRgb(c);
      if (rgb) seen.set(rgb.join(','), rgb);
    };
    for (const svg of Object.values(svgs)) svg.querySelectorAll('[fill]').forEach((el) => add(el.getAttribute('fill')));
    Object.values(PAL).forEach(add);
    ['#000000', '#ffffff'].forEach(add);
    palette = [...seen.values()];
  }

  function nearest(r, g, b) {
    let best = palette[0];
    let bd = Infinity;
    for (const p of palette) {
      const d = (p[0] - r) ** 2 + (p[1] - g) ** 2 + (p[2] - b) ** 2;
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  // The whole-pet transform (squash / sway on the frame-by-frame animations) about #pet's origin.
  function petTransform() {
    const ox = W / 2;
    const oy = H - 4;
    const x = gsap.getProperty(petEl, 'x') || 0;
    const y = gsap.getProperty(petEl, 'y') || 0;
    const r = gsap.getProperty(petEl, 'rotation') || 0;
    const sx = gsap.getProperty(petEl, 'scaleX');
    const sy = gsap.getProperty(petEl, 'scaleY');
    return `translate(${ox + x} ${oy + y}) rotate(${r}) scale(${sx ?? 1} ${sy ?? 1}) translate(${-ox} ${-oy})`;
  }

  // Returns the skew it applied (degrees), so faces can be kept square.
  function leanInstead(el, alsoOn, restore) {
    const c = el._gsap;
    const rot = c ? parseFloat(c.rotation) || 0 : 0; // GSAP may keep it as "8deg"
    if (!rot) return 0;
    const quarter = Math.round(rot / 90) * 90;
    const rest = rot - quarter;
    if (Math.abs(rest) < 0.01) return 0;
    const ox = c.xOrigin || 0;
    const oy = c.yOrigin || 0;
    const n = (v) => parseFloat(v) || 0; // GSAP keeps x / y as strings like "3px"
    const t = `translate(${n(c.x) + n(c.xOffset)} ${n(c.y) + n(c.yOffset)}) translate(${ox} ${oy}) rotate(${quarter}) skewX(${-rest}) scale(${parseFloat(c.scaleX ?? 1)} ${parseFloat(c.scaleY ?? 1)}) translate(${-ox} ${-oy})`;
    for (const target of [el, ...alsoOn]) {
      if (!target) continue;
      restore.push([target, target.getAttribute('transform')]);
      target.setAttribute('transform', t);
    }
    return -rest;
  }

  // Eyes and other face pixels lean along with the body but stay square: un-skew each about
  // its own centre.
  function keepSquare(parts, skew, restore) {
    if (!skew) return;
    for (const el of parts) {
      if (!el || el.getAttribute('opacity') === '0') continue;
      const b = el.getBBox();
      if (!b.width) continue;
      const cx = b.x + b.width / 2;
      const cy = b.y + b.height / 2;
      const t = el.getAttribute('transform');
      restore.push([el, t]);
      el.setAttribute('transform', `${t || ''} translate(${cx} ${cy}) skewX(${-skew}) translate(${-cx} ${-cy})`);
    }
  }

  let busy = false;
  async function frame() {
    const svg = Object.values(svgs).find((s) => s.classList.contains('active'));
    if (!svg || busy || !palette.length) return;
    busy = true;
    try {
      const [vx, vy] = svg.getAttribute('viewBox').split(/\s+/).map(Number);
      const x0 = Number(svg.dataset.x0);
      const y0 = Number(svg.dataset.y0);
      // Pixel artists don't rotate a sprite by a few degrees, they lean it: for this frame only,
      // turn any tilt that isn't a whole quarter turn into a skew (horizontal edges stay level,
      // the sides step over pixel by pixel). Whole quarter turns stay real rotations.
      const restore = [];
      const r = svgs.walk.rig;
      if (svg === svgs.walk) {
        const skew = leanInstead(r.body, [r.legClip], restore);
        const c = r.costume || {};
        keepSquare([r.eyes, r.closedEyes, r.squint, r.dizzyEyes, c.happyEyes, c.detEyes, c.glasses], skew, restore);
        leanInstead(r.group, [], restore);
      }
      const inner = Array.from(svg.childNodes).map((n) => xs.serializeToString(n)).join('');
      restore.forEach(([el, t]) => (t == null ? el.removeAttribute('transform') : el.setAttribute('transform', t)));
      const markup = `<svg xmlns="http://www.w3.org/2000/svg" width="${LO_W * SUB}" height="${LO_H * SUB}" viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges">`
        + `<g transform="${petTransform()}"><g transform="translate(${x0} ${y0}) scale(${SCALE}) translate(${-vx} ${-vy})">${inner}</g></g></svg>`;
      const img = new Image();
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
      await img.decode();

      hctx.clearRect(0, 0, hi.width, hi.height);
      hctx.drawImage(img, 0, 0, hi.width, hi.height);
      const src = hctx.getImageData(0, 0, hi.width, hi.height).data;
      const out = lctx.createImageData(LO_W, LO_H);
      const px = out.data;
      const half = SUB >> 1;
      for (let y = 0; y < LO_H; y++) {
        for (let x = 0; x < LO_W; x++) {
          const s = ((y * SUB + half) * hi.width + (x * SUB + half)) * 4;
          const d = (y * LO_W + x) * 4;
          if (src[s + 3] < 128) continue; // transparent (alpha cut, no half-see-through pixels)
          const [r, g, b] = nearest(src[s], src[s + 1], src[s + 2]);
          px[d] = r; px[d + 1] = g; px[d + 2] = b; px[d + 3] = 255;
        }
      }
      lctx.putImageData(out, 0, 0);

      vctx.clearRect(0, 0, view.width, view.height);
      vctx.drawImage(lo, 0, 0, view.width, view.height);

      // the window moves on the same beat, in whole art pixels
      if (winPos.pending) {
        const [wx, wy] = winPos.pending;
        winPos.pending = null;
        window.pet.setPos(Math.round(wx / PIXEL) * PIXEL, Math.round(wy / PIXEL) * PIXEL);
      }
    } catch (err) {
      console.warn('pixel frame', err);
    } finally {
      busy = false;
    }
  }

  let timer = null;
  return {
    start() {
      buildPalette();
      clearInterval(timer);
      timer = setInterval(() => { if (!state.paused) frame(); }, 1000 / FPS);
      frame();
    },
  };
}

const pixelView = {
  impl: null,
  start() { (this.impl ??= makePixelView()).start(); },
};
