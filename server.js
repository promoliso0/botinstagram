require('dotenv').config({ path: '../.env' });
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DATA_FILE = path.join(__dirname, 'data', 'promos.json');
const MAX_PROMOS = 20;
const EXPIRY_HOURS = 24;
const API_SECRET = process.env.LINKPAGE_SECRET || 'mude-esta-senha';

function lerPromos() {
  if (!fs.existsSync(DATA_FILE)) return [];
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function salvarPromos(promos) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(promos, null, 2));
}

function marcarExpiradas(promos) {
  const agora = Date.now();
  return promos.map(p => ({
    ...p,
    expirada: p.expirada || (agora - p.timestamp > EXPIRY_HOURS * 60 * 60 * 1000)
  }));
}

app.get('/api/promos', (req, res) => {
  let promos = lerPromos();
  promos = marcarExpiradas(promos);
  salvarPromos(promos);
  res.json(promos);
});

app.post('/api/promo', (req, res) => {
  if (req.headers['x-api-secret'] !== API_SECRET) {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  const { nomeProduto, precoAntigo, precoNovo, desconto, cupom, linkCompra } = req.body;
  if (!nomeProduto || !linkCompra) {
    return res.status(400).json({ error: 'nomeProduto e linkCompra são obrigatórios' });
  }
  let promos = lerPromos();
  promos = marcarExpiradas(promos);
  promos.unshift({
    id: Date.now(),
    timestamp: Date.now(),
    nomeProduto, precoAntigo, precoNovo, desconto,
    cupom: cupom || null,
    linkCompra,
    expirada: false
  });
  if (promos.length > MAX_PROMOS) promos = promos.slice(0, MAX_PROMOS);
  salvarPromos(promos);
  console.log(`✅ Nova promo adicionada: ${nomeProduto}`);
  res.json({ ok: true, total: promos.length });
});

app.delete('/api/promo/:id', (req, res) => {
  if (req.headers['x-api-secret'] !== API_SECRET) {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  let promos = lerPromos();
  promos = promos.filter(p => p.id !== parseInt(req.params.id));
  salvarPromos(promos);
  res.json({ ok: true });
});

// Rota catch-all para o React Router funcionar
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🔗 PromoLiso rodando em http://localhost:${PORT}`);
});
