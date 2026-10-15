const { cmd, all, create, SERVICES, HOURS } = require('./_db');

module.exports = async (req, res) => {
  const pass = process.env.ADMIN_PASSWORD || 'katielly123';
  if (req.headers['x-admin-password'] !== pass) return res.status(401).json({ error: 'Senha incorreta' });
  try {
    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    if (req.method === 'GET') {
      return res.status(200).json({ bookings: await all() });
    }
    if (req.method === 'POST') { // agendamento de balcão
      const name = String(b.name || '').trim().slice(0, 80);
      if (!name) return res.status(400).json({ error: 'Informe o nome' });
      if (!SERVICES[b.service]) return res.status(400).json({ error: 'Serviço inválido' });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date || '') || !HOURS.includes(b.time)) return res.status(400).json({ error: 'Data/horário inválidos' });
      const rec = { name, phone: String(b.phone || '').replace(/\D/g, '').slice(0, 15), service: b.service,
        serviceName: SERVICES[b.service].name, price: SERVICES[b.service].price, date: b.date, time: b.time,
        status: 'confirmado', source: 'balcao', createdAt: new Date().toISOString() };
      if (!(await create(rec))) return res.status(409).json({ error: 'Horário já ocupado' });
      return res.status(200).json({ ok: true });
    }
    if (req.method === 'PATCH') { // muda status / pagamento
      const key = `${b.date}|${b.time}`;
      const cur = JSON.parse((await cmd(['HGET', 'bookings', key])) || 'null');
      if (!cur) return res.status(404).json({ error: 'Não encontrado' });
      if (!['confirmado', 'concluido', 'cancelado'].includes(b.status)) return res.status(400).json({ error: 'Status inválido' });
      cur.status = b.status;
      cur.payment = b.status === 'concluido' && ['pix', 'cartao', 'dinheiro'].includes(b.payment) ? b.payment : null;
      await cmd(['HSET', 'bookings', key, JSON.stringify(cur)]);
      return res.status(200).json({ ok: true });
    }
    if (req.method === 'DELETE') { // apaga definitivamente do banco
      if (!b.date || !b.time) return res.status(400).json({ error: 'Dados inválidos' });
      await cmd(['HDEL', 'bookings', `${b.date}|${b.time}`]);
      return res.status(200).json({ ok: true });
    }
    res.status(405).end();
  } catch (e) {
    res.status(500).json({ error: 'Erro no servidor' });
  }
};
