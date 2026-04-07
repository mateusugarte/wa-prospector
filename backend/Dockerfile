FROM node:20-alpine

WORKDIR /app

# Instala dependências primeiro (cache layer)
COPY package*.json ./
RUN npm ci --omit=dev

# Copia código fonte
COPY src/ ./src/

# Porta exposta
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["node", "src/index.js"]
