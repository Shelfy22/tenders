FROM node:22-alpine AS builder

WORKDIR /app

COPY backend/package.json backend/package-lock.json ./backend/
COPY frontend/package.json frontend/package-lock.json ./frontend/

RUN npm ci --prefix backend && npm ci --prefix frontend

COPY backend/ ./backend/
COPY frontend/ ./frontend/

RUN npm run build --prefix backend && npm run build --prefix frontend

FROM node:22-alpine AS runtime

ENV NODE_ENV=production
ENV PORT=4000

WORKDIR /app

COPY backend/package.json backend/package-lock.json ./backend/
RUN npm ci --omit=dev --prefix backend && npm cache clean --force

COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/frontend/dist ./frontend/dist

USER node

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O - "http://127.0.0.1:${PORT}/api/health" > /dev/null || exit 1

CMD ["node", "backend/dist/index.js"]
