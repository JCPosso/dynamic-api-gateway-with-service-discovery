FROM node:18-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --production || true
COPY app.js ./
EXPOSE 3000
CMD ["node","app.js"]
