FROM node:18-alpine
WORKDIR /app
COPY users/package*.json ./
RUN npm install --production
COPY registerIp.js ./
COPY users/app.js ./
EXPOSE 3000
CMD ["node", "app.js"]