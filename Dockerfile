FROM oven/bun:1

WORKDIR /app

# Install dependencies first (layer-cache friendly)
COPY package.json bun.lock ./
COPY core/package.json ./core/
COPY client/package.json ./client/
COPY server/package.json ./server/

RUN bun install --frozen-lockfile

# Copy full source
COPY . .

# VITE_ variables are inlined at build time — declare as ARG so Railway can inject them
ARG VITE_SENTRY_DSN
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN

# Build the Vite client — skip tsc (typecheck runs in CI, not during image build)
RUN cd client && bun --bun vite build

# Generate the Prisma client (no DB needed — reads schema only)
RUN cd server && bunx prisma generate

ENV NODE_ENV=production
EXPOSE 3000

# Migrate then start (railway.toml startCommand overrides this in Railway)
CMD ["bun", "server/src/index.ts"]
