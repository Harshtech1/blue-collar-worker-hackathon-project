# Stage 1: Build the frontend
FROM node:14 AS build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Serve the app with static files
FROM node:14
WORKDIR /app
COPY --from=build /app/build ./build
COPY Backend/package.json Backend/package-lock.json ./Backend/
RUN npm install --production
COPY Backend/ ./Backend/
EXPOSE 3000
CMD ["node", "Backend/index.js"]