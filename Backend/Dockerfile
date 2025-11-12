# frontend/Dockerfile.dev
FROM node:22

WORKDIR /app

COPY /api/package*.json ./

RUN npm install 

COPY ./api .

RUN npx prisma generate

EXPOSE 3000

CMD ["npm", "run", "start:dev"]