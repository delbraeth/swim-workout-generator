FROM node:20-alpine

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund

# Copy app source
COPY server.js ./
COPY db.js ./
COPY lib/ ./lib/
COPY public/ ./public/
COPY vendor-kit/ ./vendor-kit/
# SPA-split: the server's workout engine (lib/generator.js) reads the engine
# prelude from src/app.jsx (the esbuild entry). The browser loads the prebuilt
# public/assets/app.js (committed/deployed; not built in-image).
COPY src/ ./src/

# Hyperlift sets PORT; default to 8080 for local runs
ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
