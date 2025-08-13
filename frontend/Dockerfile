FROM node:18-alpine

WORKDIR /app

# Install dependencies (including devDependencies for development)
COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]