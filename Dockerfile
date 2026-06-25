FROM mcr.microsoft.com/playwright:v1.45.1-jammy

# Set working directory
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9.5.0

# Copy repository files
COPY . .

# Install dependencies
RUN pnpm install

# Build the shared package first
RUN pnpm --filter @itr/shared build

# Build other packages
RUN pnpm --filter @itr/service build
RUN pnpm --filter @itr/automation build

# Make the start script executable
RUN chmod +x start.sh

# Expose Render's default port for the UI
EXPOSE 3000

# Start both frontend and backend
CMD ["./start.sh"]
