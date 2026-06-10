# Media worker — the only app that runs in Docker (because of FFmpeg).
FROM node:20-bookworm-slim

# FFmpeg/ffprobe for probe + transcode.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm@9.15.9

WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile

CMD ["pnpm", "--filter", "@mpp/worker", "start"]
