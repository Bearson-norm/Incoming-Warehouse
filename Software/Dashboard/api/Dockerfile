FROM node:18-bookworm-slim AS builder

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci \
  && npm cache clean --force

COPY . .

RUN npx prisma generate \
  && npm run build \
  && npm run build:scripts \
  && (test -f dist/src/main.js || test -f dist/main.js) \
  && npm prune --omit=dev \
  && npm cache clean --force

FROM node:18-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends wget openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma/

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist-scripts ./dist-scripts
COPY --from=builder /app/data ./data

EXPOSE 4123

CMD ["sh", "-c", "npx prisma migrate deploy && npm run start:prod"]
