FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates python3 python3-venv && rm -rf /var/lib/apt/lists/*
RUN python3 -m venv /opt/ytdlp
COPY requirements-media.txt /tmp/requirements-media.txt
RUN /opt/ytdlp/bin/pip install --no-cache-dir -r /tmp/requirements-media.txt
ENV YTDLP_PATH=/opt/ytdlp/bin/yt-dlp
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY public ./public
COPY server.js media.js ./
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
USER node
CMD ["node", "server.js"]
