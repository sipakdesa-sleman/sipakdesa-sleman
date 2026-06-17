# Stage 1: Build the React Application
FROM node:20-alpine AS builder

WORKDIR /app

# Salin file package.json dan package-lock.json untuk mengunduh dependensi
COPY package*.json ./

# Pasang dependensi secara bersih (clean install)
RUN npm ci

# Salin seluruh kode sumber proyek ke dalam kontainer
COPY . .

# Terima build arguments untuk variabel lingkungan Supabase
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY

# Ekspor variabel lingkungan ke environment builder agar dievaluasi oleh Vite Compiler
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

# Lakukan kompilasi production build
RUN npm run build

# Stage 2: Serve aplikasi statis dengan Nginx
FROM nginx:1.25-alpine

WORKDIR /usr/share/nginx/html

# Bersihkan direktori bawaan Nginx
RUN rm -rf ./*

# Salin build artifacts dari builder ke root Nginx
COPY --from=builder /app/dist .

# Salin konfigurasi Nginx khusus yang patuh standar keamanan
COPY nginx.conf /etc/nginx/nginx.conf

# Expose port HTTP default kontainer
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
