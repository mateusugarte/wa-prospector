FROM node:20-alpine

WORKDIR /app

# Instala dependências primeiro (cache layer)
# Caminhos relativos à raiz do repo (EasyPanel usa / como build context)
COPY backend/package*.json ./
RUN npm ci --omit=dev

# Copia código fonte
COPY backend/src/ ./src/

# Porta exposta
EXPOSE 3001

CMD ["node", "src/index.js"]
