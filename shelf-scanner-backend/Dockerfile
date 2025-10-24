# BookShelf/shelf-scanner-backend/Dockerfile

# 1. Node.js'in uygun sürümünü temel al
FROM node:20-alpine AS base

# 2. Çalışma dizini oluştur ve ayarla
WORKDIR /app

# 3. Bağımlılıkları kurmak için package dosyalarını kopyala
COPY package*.json ./

# 4. Bağımlılıkları kur (Sadece production için olanları kurmak daha iyi olabilir ama şimdilik hepsi)
RUN npm install

# 5. Tüm proje kodunu kopyala
COPY . .

# 6. Uygulamanın çalışacağı port
EXPOSE 3001

# 7. Container başladığında çalıştırılacak komut
CMD [ "node", "server.js" ]