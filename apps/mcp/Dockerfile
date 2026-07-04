# Build context is the repo root (Nx monorepo): docker build -f apps/mcp/Dockerfile .
FROM node:20-alpine AS build
WORKDIR /repo

COPY package.json package-lock.json nx.json tsconfig.base.json ./
COPY apps/mcp apps/mcp
COPY libs/triz-core libs/triz-core

RUN npm ci
RUN npx nx run mcp:build:production

# Runtime stage only needs the bundled server plus its runtime npm deps
# (the generated package.json/package-lock.json list just @modelcontextprotocol/sdk + zod).
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV MCP_HOST=0.0.0.0

COPY --from=build /repo/dist/apps/mcp/package.json /repo/dist/apps/mcp/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /repo/dist/apps/mcp/main.cjs ./main.cjs

USER node
EXPOSE 8080
CMD ["node", "main.cjs"]
