# Development-only Metro container.
# It does NOT replace native Android/iOS builds.
FROM node:22-bookworm-slim
WORKDIR /workspace/mobile
COPY package.json ./
RUN npm install
COPY . .
EXPOSE 8081
CMD ["npm", "start", "--", "--host", "0.0.0.0"]
