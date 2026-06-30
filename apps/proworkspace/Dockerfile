FROM node:24-alpine

WORKDIR /app

# Install required system packages
RUN apk add --no-cache \
    git \
    openssh \
    gnupg \
    bash \
    curl \
    ca-certificates \
    tini \
    dcron

COPY package*.json ./
COPY packages ./packages

RUN npm install

COPY . .

RUN node scripts/build-workspaces.mjs
RUN node packages/zeruxjs/dist/bin/zerux.js build

# Create cron log directory
RUN mkdir -p /var/log/cron

# Copy startup script
COPY scripts/start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 3000
EXPOSE 9000

ENTRYPOINT ["/sbin/tini", "--"]

CMD ["/start.sh"]
