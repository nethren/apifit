# One Node process; TLS and request limits belong at the ingress as well.
FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

FROM dependencies AS build
COPY index.html vite.config.mjs ./
COPY src ./src
COPY public ./public
COPY server ./server
COPY shared ./shared
COPY scripts ./scripts
COPY tests ./tests
RUN npm run check

FROM node:22-bookworm-slim AS production-dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production APIFIT_MODE=hosted APIFIT_AI_ENABLED=false APIFIT_DATA_DIR=/data PORT=8080
WORKDIR /app
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY package.json ./
COPY --from=build /app/dist ./dist
COPY server ./server
COPY shared ./shared
COPY scripts/container-health.mjs ./scripts/container-health.mjs
RUN mkdir /data && chown node:node /data
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD ["node", "scripts/container-health.mjs"]
CMD ["node", "server/index.mjs"]
