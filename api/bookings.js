const { all, create, busyOf, SERVICES, HOURS } = require('./_db');

module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') {
      const date = req.query.date;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return res.status(400).json({ error: 'Data inválida' });
      return res.status(200).json({ busy: busyOf((await all()).filter(b => b.date === date)) });
    }
    if (req.method === 'POST') {
      const b = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const name = String(b.name || '').trim().slice(0, 80);
      const phone = String(b.phone || '').replace(/\D/g, '').slice(0, 15);
      if (!name || phone.length < 10) return res.status(400).json({ error: 'Informe nome e WhatsApp válidos' });
      if (!SERVICES[b.service]) return res.status(400).json({ error: 'Serviço inválido' });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date || '') || !HOURS.includes(b.time))
        return res.status(400).json({ error: 'Data/horário inválidos' });
      if (new Date(b.date + 'T12:00:00').getDay() === 0) return res.status(400).json({ error: 'Domingo fechado' });
      const rec = { name, phone, service: b.service, serviceName: SERVICES[b.service].name, price: SERVICES[b.service].price,
        date: b.date, time: b.time, status: 'confirmado', source: 'site', createdAt: new Date().toISOString() };
      if (!(await create(rec))) return res.status(409).json({ error: 'Esse horário acabou de ser reservado. Escolha outro.' });
      return res.status(200).json({ ok: true, booking: rec });
    }
    res.status(405).end();
  } catch (e) {
    res.status(500).json({ error: /Banco de dados/.test(e.message) ? e.message : 'Erro no servidor' });
  }
};
