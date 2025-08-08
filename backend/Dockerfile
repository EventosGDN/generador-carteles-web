# Imagen base ligera con Node 18
FROM node:18-slim

# Dependencias mínimas para Puppeteer/Chromium + fontconfig
RUN apt-get update && apt-get install -y \
    chromium \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 \
    libxcomposite1 libxrandr2 libgbm1 libasound2 libpangocairo-1.0-0 \
    libxshmfence1 libglu1 fonts-liberation libappindicator3-1 libx11-xcb1 \
    fontconfig \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# Copiá la fuente a backend/fonts/miso-bold.ttf en tu repo
COPY fonts/miso-bold.ttf /app/fonts/miso-bold.ttf
RUN fc-cache -f -v

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 3000
CMD ["npm", "start"]
