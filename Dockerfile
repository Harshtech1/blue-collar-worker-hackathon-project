# Dockerfile to run the Backend Express app
FROM node:18-alpine

# Create app directory
WORKDIR /app

# Install dependencies (copy package.json first for caching)
COPY Backend/package*.json ./

RUN npm install --production

# Copy backend source
COPY Backend/ ./

# Create a non-root user and switch to it
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Expose port (Render sets PORT env var at runtime)
EXPOSE 3000

# Default env for PORT (can be overridden by Render)
ENV PORT=3000

# Start the app (Backend package.json uses node src/index.js)
CMD ["node", "src/index.js"]