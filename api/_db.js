// Armazenamento: Upstash Redis / Vercel KV (via REST). Sem as variáveis, usa memória (apenas para testes).
const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const fs = require('fs');
const FILE = require('path').join(__dirname, '..', 'dev-data.json');
const mem = (globalThis.__mem = globalThis.__mem || (() => { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return {}; } })());
const save = () => { if (!process.env.VERCEL) try { fs.writeFileSync(FILE, JSON.stringify(mem)); } catch {} };

const SERVICES = {
  sobrancelha: { name: 'Design de Sobrancelhas', price: 30, dur: 60 },
  henna: { name: 'Design com Henna', price: 40, dur: 90 },
};
const HOURS = ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00'];
const CLOSE = 18 * 60;
const toMin = t => +t.slice(0, 2) * 60 + +t.slice(3);
const durOf = b => b.dur || (SERVICES[b.service] || {}).dur || 60;
// Intervalos [início, fim) em minutos das reservas ativas de um dia
const busyOf = list => list.filter(b => b.status !== 'cancelado').map(b => ({ start: toMin(b.time), end: toMin(b.time) + durOf(b) }));
const fits = (rec, list) => {
  const s = toMin(rec.time), e = s + durOf(rec);
  return e <= CLOSE && !busyOf(list).some(b => s < b.end && e > b.start);
};

async function cmd(args) {
  if (!URL_ || !TOKEN) {
    if (process.env.VERCEL) throw new Error('Banco de dados não configurado (Upstash Redis)');
    const r = memCmd(args); save(); return r;
  }
  const r = await fetch(URL_, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}

function memCmd([c, key, f, v]) {
  mem[key] = mem[key] || {};
  if (c === 'HSETNX') { if (f in mem[key]) return 0; mem[key][f] = v; return 1; }
  if (c === 'HSET') { mem[key][f] = v; return 1; }
  if (c === 'HGET') return mem[key][f] ?? null;
  if (c === 'HGETALL') return Object.entries(mem[key]).flat();
  if (c === 'HDEL') { const had = f in mem[key]; delete mem[key][f]; return had ? 1 : 0; }
}

async function all() {
  const flat = (await cmd(['HGETALL', 'bookings'])) || [];
  const out = [];
  for (let i = 0; i < flat.length; i += 2) out.push(JSON.parse(flat[i + 1]));
  return out;
}

// Cria reserva; horário cancelado volta a ficar livre. Retorna o registro ou null se ocupado.
async function create(rec) {
  rec.dur = SERVICES[rec.service].dur;
  const sameDay = (await all()).filter(b => b.date === rec.date);
  if (!fits(rec, sameDay)) return null;
  const key = `${rec.date}|${rec.time}`;
  const ok = await cmd(['HSETNX', 'bookings', key, JSON.stringify(rec)]);
  if (ok) return rec;
  const cur = JSON.parse((await cmd(['HGET', 'bookings', key])) || 'null');
  if (cur && cur.status === 'cancelado') {
    await cmd(['HSET', 'bookings', key, JSON.stringify(rec)]);
    return rec;
  }
  return null;
}

module.exports = { cmd, all, create, busyOf, SERVICES, HOURS };
