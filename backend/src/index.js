require('dotenv').config();

const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { testConnection } = require('./lib/supabase');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

// Middlewares
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json());

// Disponibiliza io globalmente para rotas/workers
app.set('io', io);

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
server.listen(PORT, () => {
  console.log(`[server] Backend rodando em http://localhost:${PORT}`);
});
