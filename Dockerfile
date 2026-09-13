# Dockerfile for Fleet Management System
FROM node:20-alpine AS builder

WORKDIR /app

# نصب وابستگی‌ها
COPY package*.json ./
RUN npm install

# کپی سورس کد و بیلد کامل فرانت‌اند و بک‌اند
COPY . .
RUN npm run build

# مرحله نهایی اجرا
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# کپی فایل‌های بیلد شده و پکیج‌ها
COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/server.cjs"]
