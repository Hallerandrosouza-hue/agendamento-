const WHATS = '5589981298247';
const SV = {
  sobrancelha: { name: 'Design de Sobrancelhas', desc: 'Mapeamento do rosto, design personalizado e finalização.', price: 'R$ 30,00', dur: 60, label: '1h' },
  henna: { name: 'Design com Henna', desc: 'Design completo com aplicação de henna.', price: 'R$ 40,00', dur: 90, label: '1h30' },
};
const HOURS = ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00'];
const st = { step: 0, service: null, date: null, time: null, name: '', phone: '', err: '' };
const $ = s => document.querySelector(s);
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const DOW = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

function render() {
  [...$('#steps').children].forEach((li, i) => li.classList.toggle('on', i <= st.step));
  const p = $('#panel');
  const back = st.step > 0 && st.step < 4 ? '<button class="back" id="back">← Voltar</button>' : '';
  if (st.step === 0) {
    p.innerHTML = '<div class="opts two">' + Object.entries(SV).map(([k, v]) =>
      `<button class="opt sv" data-k="${k}"><b>${v.name}</b><span>${v.desc}</span><br><br><span>${v.price} · 1h</span></button>`).join('') + '</div>';
    p.querySelectorAll('.opt').forEach(b => b.onclick = () => { st.service = b.dataset.k; st.step = 1; render(); });
  } else if (st.step === 1) {
    const days = [], now = new Date();
    for (let i = 0; i < 30; i++) { const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i); if (d.getDay() !== 0) days.push(d); }
    p.innerHTML = back + '<div class="opts">' + days.map(d =>
      `<button class="opt" data-d="${iso(d)}"><small>${DOW[d.getDay()]}</small>${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}</button>`).join('') + '</div>';
    p.querySelectorAll('.opt').forEach(b => b.onclick = () => { st.date = b.dataset.d; st.step = 2; render(); });
  } else if (st.step === 2) {
    p.innerHTML = back + '<p class="lead" style="margin:0 0 14px">Carregando horários...</p>';
    loadSlots();
  } else if (st.step === 3) {
    p.innerHTML = back + `<div class="sum"><b>${SV[st.service].name}</b> · ${SV[st.service].price}<br>${fmtDate(st.date)} às ${st.time}</div>
      <label class="field">Seu nome<input id="n" value="${st.name}" placeholder="Nome completo" autocomplete="name"></label>
      <label class="field">Seu WhatsApp<input id="ph" value="${st.phone}" placeholder="(89) 99999-9999" inputmode="tel" autocomplete="tel"></label>
      <div class="err">${st.err}</div><button class="btn" id="go" style="width:100%">Confirmar agendamento</button>`;
    $('#go').onclick = submit;
  } else {
    const msg = `Olá! Acabei de agendar no site:\nNome: ${st.name}\nServiço: ${SV[st.service].name}\nData: ${st.date}\nHorário: ${st.time}`;
    const link = `https://wa.me/${WHATS}?text=${encodeURIComponent(msg)}`;
    p.innerHTML = `<div class="done"><div style="font-size:40px">✨</div><h3>Horário reservado!</h3>
      <p class="lead" style="margin:0 auto 20px">${fmtDate(st.date)} às ${st.time}. Envie a confirmação pelo WhatsApp para finalizar.</p>
      <a class="btn" target="_blank" href="${link}" id="wa">Enviar no WhatsApp</a><br><br>
      <button class="back" id="again">Fazer outro agendamento</button></div>`;
    $('#again').onclick = () => { Object.assign(st, { step: 0, service: null, date: null, time: null, err: '' }); render(); };
    window.open(link, '_blank');
  }
  const bk = $('#back'); if (bk) bk.onclick = () => { st.step--; render(); };
}

function fmtDate(s) { const [y, m, d] = s.split('-'); const dt = new Date(y, m - 1, d); return `${DOW[dt.getDay()]}, ${d}/${m}/${y}`; }

async function loadSlots() {
  let taken = [];
  try { taken = (await (await fetch('/api/bookings?date=' + st.date)).json()).taken || []; } catch (e) {}
  const now = new Date(), today = iso(now);
  const p = $('#panel');
  p.innerHTML = '<button class="back" id="back">← Voltar</button><p class="lead" style="margin:0 0 14px;text-align:left">' + fmtDate(st.date) + '</p><div class="opts">' +
    HOURS.map(h => {
      const past = st.date === today && parseInt(h) <= now.getHours();
      return `<button class="opt" data-h="${h}" ${taken.includes(h) || past ? 'disabled' : ''}>${h}</button>`;
    }).join('') + '</div>';
  $('#back').onclick = () => { st.step--; render(); };
  p.querySelectorAll('.opt').forEach(b => b.onclick = () => { st.time = b.dataset.h; st.step = 3; render(); });
}

async function submit() {
  st.name = $('#n').value.trim(); st.phone = $('#ph').value.trim();
  if (!st.name || st.phone.replace(/\D/g, '').length < 10) { st.err = 'Informe seu nome e um WhatsApp válido.'; return render(); }
  const b = $('#go'); b.disabled = true; b.textContent = 'Reservando...';
  try {
    const r = await fetch('/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: st.name, phone: st.phone, service: st.service, date: st.date, time: st.time }) });
    const j = await r.json();
    if (!r.ok) { st.err = j.error || 'Erro ao agendar.'; if (r.status === 409) { st.step = 2; } return render(); }
    st.err = ''; st.step = 4; render();
  } catch (e) { st.err = 'Sem conexão. Tente novamente.'; render(); }
}

document.querySelectorAll('[data-s]').forEach(b => b.onclick = () => {
  Object.assign(st, { service: b.dataset.s, step: 1 }); render(); $('#agendamento').scrollIntoView();
});

// Galeria: coloque fotos em public/gallery/1.jpg ... 6.jpg
(async () => {
  const g = $('#gallery');
  for (let i = 1; i <= 6; i++) {
    await new Promise(res => { const im = new Image(); im.onload = () => { g.appendChild(im); res(); }; im.onerror = res; im.src = `/gallery/${i}.jpg`; });
  }
  if (g.children.length) $('#resultados').hidden = false;
  g.onclick = e => {
    if (e.target.tagName !== 'IMG') return;
    const lb = document.createElement('div'); lb.className = 'lightbox';
    lb.innerHTML = `<img src="${e.target.src}" alt="">`; lb.onclick = () => lb.remove(); document.body.appendChild(lb);
  };
})();
render();

