FROM node:22-bookworm-slim AS builder

ENV CI=true
ENV PNPM_HOME=/pnpm
ENV PATH=/pnpm:$PATH

WORKDIR /workspace

RUN corepack enable

COPY . .

RUN pnpm install --frozen-lockfile --ignore-scripts
RUN pnpm -F @wrjdyk/backend-api run build
RUN pnpm deploy \
  --filter @wrjdyk/backend-api \
  --prod \
  --legacy \
  --ignore-scripts \
  /opt/backend

FROM node:22-bookworm-slim AS production

ENV NODE_ENV=production
ENV PORT=3999

WORKDIR /workspace

COPY --from=builder /opt/backend/node_modules ./node_modules
COPY --from=builder /opt/backend/package.json ./package.json
COPY --from=builder /workspace/apps/backend-api/dist ./apps/backend-api/dist
COPY --from=builder /workspace/apps/backend-api/prompts ./apps/backend-api/prompts

RUN mkdir -p \
  /workspace/apps/backend-api/data \
  /workspace/ceshi \
  /workspace/media-cache \
  /workspace/releases \
  && chown -R node:node /workspace

USER node

EXPOSE 3999

CMD ["node", "apps/backend-api/dist/main.js"]
