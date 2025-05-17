# base image is bun and node
FROM imbios/bun-node:latest-18-alpine

WORKDIR /app

COPY "package*.json" ./

RUN bun install

COPY . .

ENV PORT=8080

EXPOSE 8080

CMD ["bun", "run", "server.ts"]