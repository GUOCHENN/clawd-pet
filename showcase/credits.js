// Shared credits strip for both posters. Change AUTHOR here and re-render to update both.
const AUTHOR = 'Santino';

function renderCredits(el) {
  el.innerHTML = `
    <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:24px">
      <div>
        <div style="font-family:Silkscreen;font-size:18px;letter-spacing:1px;color:#3A3E6B">CREADO POR</div>
        <div style="font-family:Fredoka;font-weight:700;font-size:56px;line-height:1;color:#1F2240">${AUTHOR}</div>
      </div>
      <div style="text-align:right">
        <div style="font-family:Silkscreen;font-size:18px;letter-spacing:1px;color:#3A3E6B">CON LA AYUDA DE</div>
        <div style="font-family:Fredoka;font-weight:700;font-size:40px;line-height:1;color:#DD775B">Claude <span style="font-size:24px;color:#3A3E6B;font-weight:600">· la IA de Anthropic</span></div>
      </div>
    </div>
    <div style="margin-top:10px;font-size:15px;font-weight:700;color:#6B6F94;text-align:center">
      Clawd es la mascota de Anthropic · Proyecto personal, sin fines comerciales · Octubre 2026
    </div>`;
}
