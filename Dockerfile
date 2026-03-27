# Backend — built from repo root for Render deployment
FROM node:20-alpine

WORKDIR /app

# Copy backend package files first for layer caching
COPY Backend/package.json Backend/package-lock.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy backend source
COPY Backend/ ./

EXPOSE 5000

CMD ["node", "src/index.js"]