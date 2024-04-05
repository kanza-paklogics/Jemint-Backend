FROM node:16

WORKDIR /app

COPY package*.json ./

COPY .env .

COPY . .

RUN npm install --legacy-peer-deps

EXPOSE 3002

CMD ["npm", "start"]
