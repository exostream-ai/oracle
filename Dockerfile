# Build stage
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source
COPY tsconfig.json ./
COPY src/ ./src/

# Build
RUN npm run build

# Production stage
FROM node:20-slim AS runner

WORKDIR /app

# Copy package files and install production deps only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built output
COPY --from=builder /app/dist ./dist

# Copy seed data
COPY seed/ ./seed/

# Copy schema for migrations
COPY exostream_schema.sql ./

# Set environment
ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

# Cloud Run handles health checks via /health endpoint
# No HEALTHCHECK directive needed (Cloud Run ignores it anyway)

# Start the API
CMD ["node", "dist/api/index.js"]
