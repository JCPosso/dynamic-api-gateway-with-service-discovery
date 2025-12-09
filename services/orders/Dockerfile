FROM node:18-alpine
WORKDIR /app
COPY orders/package*.json ./
RUN npm install --production
COPY registerIp.js ./
COPY orders/index.js ./
EXPOSE 3001
CMD ["node", "index.js"]