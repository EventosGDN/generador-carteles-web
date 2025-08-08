# Imagen base ligera con Node 18
FROM node:18-slim

# Instalar solo dependencias necesarias para Puppeteer y Chromium
RUN apt-get update && apt-get install -y \
    chromium \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpangocairo-1.0-0 \
    libxshmfence1 \
    libglu1 \
    fonts-liberation \
    libappindicator3-1 \
    libx11-xcb1 \
    && rm -rf /var/lib/apt/lists/*

# Definir variable para Puppeteer (usa Chromium del sistema)
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Crear carpeta de la app
WORKDIR /app

# Copiar package.json y package-lock.json primero para aprovechar cache
COPY package*.json ./

# Instalar dependencias de producción
RUN npm install --omit=dev

# Copiar el resto del código
COPY . .

# Puerto que usará Railway
EXPOSE 3000

# Comando de inicio
CMD ["npm", "start"]
