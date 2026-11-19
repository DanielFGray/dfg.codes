# One image for the site and its server. server-ansible builds it from the committed HEAD
# (`ops release`) and runs the service and migrate command in cartridge.json.
FROM oven/bun:1.4.4

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

ENV NODE_ENV=production
EXPOSE 3000
CMD ["bun", "server/index.ts"]
