# Base Node Image
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@11.9.0 --activate

# Dependencies Builder
FROM base AS dependencies
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/database/package.json ./packages/database/
COPY packages/config/package.json ./packages/config/
RUN pnpm install --frozen-lockfile

# Application Builder
FROM dependencies AS builder
WORKDIR /app
COPY . .
RUN pnpm --filter @amdox/database build
RUN pnpm --filter backend build

# Production Runner
FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/apps/backend/package.json ./apps/backend/package.json
COPY --from=builder /app/packages/database/dist ./packages/database/dist
COPY --from=builder /app/packages/database/generated ./packages/database/generated
COPY --from=builder /app/packages/database/package.json ./packages/database/package.json
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 8080
ENV NODE_ENV=production
CMD ["node", "apps/backend/dist/main"]
