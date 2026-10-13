FROM node:24-alpine
WORKDIR /app
COPY backend/src ./backend/src
COPY shared ./shared
USER node
EXPOSE 3001
CMD ["node", "backend/src/index.js"]
