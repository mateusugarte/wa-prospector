require('dotenv').config();

const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { testConnection } = require('./lib/supabase');
const instancesRouter = require('./routes/instances');
const campaignsRouter = require('./routes/campaigns');
const contactsRouter = require('./routes/contacts');
const { resetStaleRunners } = require('./services/campaign-runner');
const { resetStaleReactivationRunners } = require('./services/reactivation-runner');
const reactivationRouter = require('./routes/reactivation');

const app = express();
const server = http.createServer(app);

// Aceita múltiplas origens: FRONTEND_URL pode ser lista separada por vírgula
// ou qualquer subdomínio *.vercel.app do projeto
function buildCorsOrigin() {
  const raw = process.env.FRONTEND_URL || 'http://localhost:5173';
  const allowed = raw.split(',').map(s => s.trim().replace(/\/$/, ''));
  return function(origin, cb) {
    if (!origin) return cb(null, true); // curl / server-to-server
    const clean = origin.replace(/\/$/, '');
    if (allowed.some(a => clean === a) || /^https:\/\/crm-alliance[a-z0-9-]*\.vercel\.app$/.test(clean)) {
      return cb(null, true);
    }
    cb(new Error('CORS: origem não permitida — ' + origin));
  };
}

const corsOrigin = buildCorsOrigin();

const io = new Server(server, {
  cors: { origin: corsOrigin, methods: ['GET', 'POST'] },
});

// Middlewares
app.use(cors({ origin: corsOrigin }));
app.use(express.json());

// Disponibiliza io globalmente para rotas/workers
app.set('io', io);

// Rotas da API
app.use('/api/instances', instancesRouter);
app.use('/api/campaigns', campaignsRouter);
app.use('/api/contacts', contactsRouter);
app.use('/api/reactivation', reactivationRouter);

// Health check leve — usado pelo EasyPanel/Docker, não faz query no banco
app.get('/health', (req, res) => {
  res.json({ ok: true });
});

// Health check completo — testa conexão real com Supabase
app.get('/health/db', async (req, res) => {
  try {
    await testConnection();
    res.json({ ok: true, supabase: 'connected' });
  } catch (err) {
    res.status(503).json({ ok: false, supabase: 'error', error: err.message });
  }
});

// Socket.io
io.on('connection', (socket) => {
  console.log('[socket.io] Cliente conectado:', socket.id);
  socket.on('disconnect', () => {
    console.log('[socket.io] Cliente desconectado:', socket.id);
  });
});

// Start
const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', async () => {
  console.log(`[server] Backend rodando em http://0.0.0.0:${PORT}`);
  await resetStaleRunners();
  console.log('[server] Campanhas travadas resetadas para pausado');
  await resetStaleReactivationRunners();
  console.log('[server] Campanhas de reativação travadas resetadas para pausado');

  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('[server] ⚠️  ANTHROPIC_API_KEY não configurada — módulo de reativação não funcionará');
  }
});
