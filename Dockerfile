FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY public ./public
COPY preview ./preview
ENV NODE_ENV=development DEMO_MODE=true PORT=3000
EXPOSE 3000
CMD ["node", "preview/server.js"]
