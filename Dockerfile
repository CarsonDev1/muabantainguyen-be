FROM node:18-alpine

WORKDIR /app

RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

COPY package*.json ./

RUN npm ci --only=production

COPY src ./src
COPY sql ./sql  
COPY scripts ./scripts

USER nodejs

EXPOSE 4000

CMD ["npm", "start"]
