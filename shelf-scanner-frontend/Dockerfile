# BookShelf/shelf-scanner-frontend/Dockerfile

# --- Aşama 1: Build Aşaması ---
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

RUN npm run build

# --- Aşama 2: Serve Aşaması ---

FROM nginx:stable-alpine

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]