# Armored Archer - Game Server Dockerfile
# Multiplayer action RPG game server
#
# This Dockerfile is used for containerizing the Nakama backend server.
# The Godot client is built separately and connects to this server.

FROM node:20-alpine

WORKDIR /app

# Copy backend files
COPY backend/package*.json ./
RUN npm ci --only=production

COPY backend/dist ./dist

EXPOSE 7350 7351

CMD ["node", "dist/index.js"]
