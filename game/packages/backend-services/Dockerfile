FROM node:22-bookworm-slim
RUN corepack enable && corepack prepare pnpm@10.33.4 --activate
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/backend-services/package.json packages/backend-services/package.json
RUN pnpm install --frozen-lockfile --filter @wobblebeans/backend-services...
COPY packages/shared packages/shared
COPY packages/backend-services packages/backend-services
WORKDIR /app/packages/backend-services
ENV PORT=8088
EXPOSE 8088
CMD ["pnpm", "exec", "tsx", "src/main.ts"]
