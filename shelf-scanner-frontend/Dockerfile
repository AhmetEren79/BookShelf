# BookShelf/shelf-scanner-frontend/Dockerfile

# --- Aşama 1: Build Aşaması ---
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# React uygulamasını derle
RUN npm run build

# --- Aşama 2: Serve Aşaması ---
# Nginx ile derlenmiş dosyaları sun
FROM nginx:stable-alpine
# Derlenmiş dosyaları Nginx'in sunucu dizinine kopyala
COPY --from=build /app/dist /usr/share/nginx/html
# Nginx'in 80 portunu aç
EXPOSE 80
# Nginx'i başlat
CMD ["nginx", "-g", "daemon off;"]