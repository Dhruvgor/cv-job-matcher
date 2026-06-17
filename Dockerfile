# Step 1: Build stage
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Step 2: Final execution stage
FROM node:20-slim
WORKDIR /app

# Install Python and pip
RUN apt-get update && apt-get install -y python3 python3-pip && rm -rf /var/lib/apt/lists/*

# Copy build files from stage 1 and configuration scripts
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/requirements.txt ./
COPY --from=builder /app/api_server.py ./

# Install python and production node dependencies
RUN npm install --production
RUN pip install --no-cache-dir -r requirements.txt --break-system-packages

# Install 'concurrently' to run both Python and Node servers together
RUN npm install -g concurrently

EXPOSE 8080

# Run BOTH the python backend and the web server together on launch
CMD ["concurrently", "python3 api_server.py", "npm start"]
