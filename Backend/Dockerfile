FROM node:20-alpine

WORKDIR /app

# Install deps first for layer caching
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy source
COPY . .

EXPOSE 5000

CMD ["node", "src/index.js"]
