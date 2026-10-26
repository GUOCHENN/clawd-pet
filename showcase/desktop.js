// Builds the shared desktop chrome (icons, taskbar, tray) for the mockup scenes.
const TRAY_ICONS = {
  wifi: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M1.5 6a9.5 9.5 0 0 1 13 0"/><path d="M4 8.7a6 6 0 0 1 8 0"/><path d="M6.4 11.2a2.6 2.6 0 0 1 3.2 0"/><circle cx="8" cy="13.4" r=".9" fill="currentColor"/></svg>',
  vol: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2 6h3l4-3v10l-4-3H2z" fill="currentColor" stroke="none"/><path d="M11 5.5a3.5 3.5 0 0 1 0 5"/><path d="M12.8 3.6a6 6 0 0 1 0 8.8"/></svg>',
  bat: '<svg width="22" height="16" viewBox="0 0 22 16" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="1" y="4" width="17" height="8.5" rx="2"/><rect x="3" y="6" width="11" height="4.5" rx="1" fill="currentColor" stroke="none"/><path d="M19.5 7v2.5"/></svg>',
  up: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2.5 7.5 6 4l3.5 3.5"/></svg>',
};

function desktopChrome({ time, date, dark = false, openApps = [0, 2] }) {
  const appColors = ['#f2b33d', '#3b7be8', '#2bb673', '#e4572e', '#8b5cf6', '#14a3b8'];
  const apps = appColors.map((c, i) => `<div class="tapp${openApps.includes(i) ? ' on' : ''}"><div class="g" style="background:${c}"></div></div>`).join('');
  return `
    <div class="taskbar${dark ? ' dark' : ''}">
      <div class="tapps">
        <div class="tapp"><div class="startbtn"><i></i><i></i><i></i><i></i></div></div>
        <div class="searchbox">⌕ Buscar</div>
        ${apps}
      </div>
      <div class="tray" style="color:${dark ? '#fff' : '#1b1b1f'}">
        ${TRAY_ICONS.up}<span>ESP</span>${TRAY_ICONS.wifi}${TRAY_ICONS.vol}${TRAY_ICONS.bat}
        <div class="clock">${time}<br>${date}</div>
      </div>
    </div>`;
}

function desktopIcons(items) {
  return `<div class="dicons">${items.map(([label, color, glyph = '']) => `
    <div class="dicon"><div class="g" style="background:${color}">${glyph}</div><span>${label}</span></div>`).join('')}</div>`;
}

function windowFrame({ x, y, w, h, title, icon = '#3b7be8', dark = false, body = '' }) {
  return `<div class="win${dark ? ' dark' : ''}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px">
    <div class="tb"><span class="ico" style="background:${icon}"></span><span class="title">${title}</span>
      <span class="ctl"><i>—</i><i>▢</i><i>✕</i></span></div>
    <div style="position:absolute;left:0;right:0;top:34px;bottom:0">${body}</div>
  </div>`;
}

// Hand-drawn style arrow from (x1,y1) to (x2,y2), curving by `bend`.
function arrow(x1, y1, x2, y2, bend = 60, color = '#ffb547') {
  const mx = (x1 + x2) / 2 - (y2 - y1) * bend / 300;
  const my = (y1 + y2) / 2 + (x2 - x1) * bend / 300;
  const ang = Math.atan2(y2 - my, x2 - mx);
  const head = (a) => `${x2 - 22 * Math.cos(ang + a)},${y2 - 22 * Math.sin(ang + a)}`;
  return `<svg class="arrow" style="left:0;top:0" width="1920" height="1080">
    <path d="M${x1},${y1} Q${mx},${my} ${x2},${y2}" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="9" stroke-linecap="round" transform="translate(0,3)"/>
    <path d="M${x1},${y1} Q${mx},${my} ${x2},${y2}" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round"/>
    <path d="M${head(0.5)} L${x2},${y2} L${head(-0.5)}" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

function creditTag() {
  return `<div class="tag">Clawd · mascota de escritorio creada por <b>${typeof AUTHOR !== 'undefined' ? AUTHOR : 'Santino'}</b> con Claude</div>`;
}
