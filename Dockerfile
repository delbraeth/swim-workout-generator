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
# DEBUG (temporary — remove after diagnosis): print what actually landed in the image's
# public/assets so we can see whether the code-split chunks/ subdir reached the container.
RUN echo "===ASSETS_DEBUG_START===" && ls -laR public/assets 2>&1; echo "===ASSETS_DEBUG_END==="
COPY vendor-kit/ ./vendor-kit/
# SPA-split: the server's workout engine (lib/generator.js) reads the engine
# prelude from src/app.jsx (the esbuild entry). The browser loads the prebuilt
# public/assets/app.js (committed/deployed; not built in-image).
COPY src/ ./src/

# Hyperlift sets PORT; default to 8080 for local runs
ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
