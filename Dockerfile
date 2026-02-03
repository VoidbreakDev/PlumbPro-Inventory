# PlumbPro Inventory - Production Dockerfile
# Multi-stage build for optimized production image

# Stage 1: Build Frontend
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDependencies needed for build)
RUN npm install --legacy-peer-deps

# Copy source and build
COPY . .
RUN npm run build

# Stage 2: Build Backend
FROM node:18-alpine AS backend-builder

WORKDIR /app/backend

# Copy server package files
COPY server/package*.json ./

# Install server dependencies
RUN npm ci --only=production

# Copy server source
COPY server/ .

# Stage 3: Production Image
FROM node:18-alpine AS production

# Install PostgreSQL client for database operations
RUN apk add --no-cache postgresql-client

# Create app directory
WORKDIR /app

# Copy backend from builder
COPY --from=backend-builder /app/backend ./server

# Copy frontend build
COPY --from=frontend-builder /app/frontend/dist ./dist

# Copy production scripts
COPY scripts/ ./scripts/
RUN chmod +x ./scripts/*.sh

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Create uploads directory and set permissions
RUN mkdir -p /app/server/uploads && chown -R nodejs:nodejs /app

# Change ownership
USER nodejs

# Expose port
EXPOSE 5001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5001/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

# Start server
CMD ["node", "server/src/server.js"]
