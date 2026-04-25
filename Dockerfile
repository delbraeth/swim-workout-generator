FROM node:20-alpine

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund

# Copy app source
COPY server.js ./
COPY public/ ./public/

# Hyperlift sets PORT; default to 8080 for local runs
ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
