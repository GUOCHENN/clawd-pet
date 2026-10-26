// Tiny pixel-art helper shared by the posters: turns ASCII rows into a crisp inline SVG.
const PX = {
  K: '#1F2240', W: '#FFFFFF', w: '#EEF4FA', O: '#DD775B', o: '#B95C43', Y: '#F4C542', y: '#E8A93A',
  R: '#E8546A', B: '#8EC5E8', b: '#5B8FC9', G: '#9ED8B8', g: '#6BB892', P: '#B8A6F0', C: '#F5EEDF',
};

function pixelSVG(rows, cell, pal = PX) {
  const w = Math.max(...rows.map((r) => r.length));
  let rects = '';
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length;) {
      const ch = row[x];
      if (!pal[ch]) { x++; continue; }
      let n = 1;
      while (row[x + n] === ch) n++;
      rects += `<rect x="${x}" y="${y}" width="${n + 0.02}" height="1.02" fill="${pal[ch]}"/>`;
      x += n;
    }
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${rows.length}" width="${w * cell}" height="${rows.length * cell}" shape-rendering="crispEdges">${rects}</svg>`;
}

// 5x7 pixel glyphs for display lettering.
const GLYPHS = {
  C: ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  W: ['#...#', '#...#', '#.#.#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
};

// A word in pixel letters with a chunky offset shadow, as one SVG.
function pixelWord(word, cell, fill, shadow, depth = 1) {
  const letters = word.split('').map((ch) => GLYPHS[ch]);
  const gap = 1;
  const width = letters.length * 5 + (letters.length - 1) * gap + depth;
  const height = 7 + depth;
  let rects = '';
  const draw = (dx, dy, color) => {
    letters.forEach((g, i) => {
      g.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
          if (row[x] === '#') rects += `<rect x="${i * (5 + gap) + x + dx}" y="${y + dy}" width="1.02" height="1.02" fill="${color}"/>`;
        }
      });
    });
  };
  for (let d = depth; d > 0; d -= 0.25) draw(d, d, shadow);
  draw(0, 0, fill);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width * cell}" height="${height * cell}" shape-rendering="crispEdges">${rects}</svg>`;
}

const ART = {
  cursor: [
    'K...........', 'KK..........', 'KWK.........', 'KWWK........', 'KWWWK.......', 'KWWWWK......',
    'KWWWWWK.....', 'KWWWWWWK....', 'KWWWWWWWK...', 'KWWWWWWWWK..', 'KWWWWWKKKKK.', 'KWWKWWK.....',
    'KWK.KWWK....', 'KK..KWWK....', 'K....KWWK...', '.....KWWK...', '......KK....',
  ],
  heart: ['.RR.RR.', 'RRRRRRR', 'RRRRRRR', '.RRRRR.', '..RRR..', '...R...'],
  sparkle: ['..Y..', '..Y..', 'YYWYY', '..Y..', '..Y..'],
  star: ['...Y...', '...Y...', '..YYY..', 'YYYYYYY', '.YYYYY.', '.YY.YY.', 'Y.....Y'],
  cloud: ['....WWWW........', '..WWWWWWWW..WW..', '.WWWWWWWWWWWWWW.', 'WWWWWWWWWWWWWWWW', 'wwwwwwwwwwwwwwww', '.wwwwwwwwwwwwww.'],
  folder: ['.yyyy.....', 'yyyyyyyyyy', 'yYYYYYYYYy', 'yYYYYYYYYy', 'yYYYYYYYYy', 'yYYYYYYYYy', 'yyyyyyyyyy'],
  note: ['..KKK', '..K.K', '..K..', 'KKK..', 'KKK..'],
  photo: ['KKKKKKKKKK', 'KBBBBBBBYK', 'KBBBBBBBBK', 'KBBGBBBBBK', 'KBGGGBBGBK', 'KGGGGGGGGK', 'KKKKKKKKKK'],
};
