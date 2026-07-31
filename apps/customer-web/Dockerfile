# Builds the Vite static site, then serves dist/ with a tiny static server.
# VITE_API_BASE_URL must be available at BUILD time (Vite bakes env vars into
# the bundle) — Railway passes service variables through as build args for
# Dockerfile-based services.
FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

FROM node:20-slim
WORKDIR /app
RUN npm install -g serve
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["serve", "-s", "dist", "-l", "tcp://0.0.0.0:3000"]
