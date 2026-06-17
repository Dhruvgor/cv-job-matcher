# Step 1: Use a reliable Node image to install packages and build the system
FROM node:20-slim

# Set the working directory inside our container
WORKDIR /app

# Install Python and core system dependencies first
RUN apt-get update && apt-get install -y python3 python3-pip && rm -rf /lib/apt/lists/*

# Copy dependency manifests first to optimize cache layers
COPY package*.json requirements.txt ./

# Install frontend node packages and python packages simultaneously
RUN npm install && pip install --no-cache-dir -r requirements.txt --break-system-packages

# Copy the rest of your app's code files into the container
COPY . .

# Build your production client static assets 
RUN npm run build

# Cloud Run injects a dynamic $PORT environment variable. Expose it!
EXPOSE 8080

# Execute the application startup sequence
CMD ["npm", "start"]
