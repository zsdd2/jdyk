FROM --platform=$BUILDPLATFORM node:22-bookworm-slim AS builder

ENV CI=true
ENV PNPM_HOME=/pnpm
ENV PATH=/pnpm:$PATH

WORKDIR /workspace

RUN corepack enable

COPY . .

RUN pnpm install --frozen-lockfile --ignore-scripts
RUN cd apps/web-antd && ../../node_modules/.bin/vite build --mode production

FROM nginx:1.27-alpine AS production

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /workspace/apps/web-antd/dist /usr/share/nginx/html

EXPOSE 8080
