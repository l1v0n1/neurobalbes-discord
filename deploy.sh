#!/bin/bash

# Neurobalbes Discord Bot deployment script
# This script is used to deploy the bot on a server

# Colors for terminal output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting Neurobalbes Discord Bot deployment...${NC}"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js is not installed. Please install Node.js 16.9.0 or higher.${NC}"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d 'v' -f 2)
REQUIRED_VERSION="16.9.0"

if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
    echo -e "${RED}Node.js version must be at least $REQUIRED_VERSION. Current version: $NODE_VERSION${NC}"
    exit 1
fi

# Function to check if config exists
check_config() {
    if [ ! -f "config.json" ]; then
        echo -e "${RED}config.json not found!${NC}"
        echo -e "${YELLOW}Creating template config.json...${NC}"
        cat > config.json << EOL
{
    "token": "YOUR_BOT_TOKEN_HERE",
    "bot_description": "Neurobalbes | /help",
    "prefix": "/",
    "clientId": "YOUR_CLIENT_ID_HERE",
    "inviteLink": "YOUR_BOT_INVITE_LINK",
    "serverLink": "YOUR_SUPPORT_SERVER_LINK",
    "adminId": "YOUR_ADMIN_ID",
    "site": "https://your-bot-website.com",
    "raw_limit": 2000,
    "shardCount": "auto",
    "shardArgs": ["--max-old-space-size=2048"]
}
EOL
        echo -e "${RED}Please edit config.json with your bot token and client ID, then run this script again.${NC}"
        exit 1
    fi

    # Check if token is set
    TOKEN=$(grep -o '"token": "[^"]*"' config.json | cut -d '"' -f 4)
    if [ "$TOKEN" = "YOUR_BOT_TOKEN_HERE" ]; then
        echo -e "${RED}Please update the bot token in config.json${NC}"
        exit 1
    fi

    # Check if client ID is set
    CLIENT_ID=$(grep -o '"clientId": "[^"]*"' config.json | cut -d '"' -f 4)
    if [ "$CLIENT_ID" = "YOUR_CLIENT_ID_HERE" ]; then
        echo -e "${RED}Please update the client ID in config.json${NC}"
        exit 1
    fi
}

# Function to install dependencies
install_deps() {
    # Install SQLite and Canvas build dependencies
    echo -e "${YELLOW}Installing build tools for SQLite3 and Canvas...${NC}"
    if command -v apt-get &> /dev/null; then
        sudo apt-get update
        # Added canvas dependencies: libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
        sudo apt-get install -y build-essential python3 libsqlite3-dev libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
    elif command -v yum &> /dev/null; then
        # Added canvas dependencies for RHEL/CentOS/Fedora
        sudo yum -y install gcc-c++ make python3 sqlite-devel cairo-devel pango-devel libjpeg-turbo-devel giflib-devel librsvg2-devel
    else
        echo -e "${YELLOW}Could not detect package manager. Please manually install build-essential, python3, sqlite3-dev, and canvas dependencies (Cairo, Pango, JPEG, GIF, RSVG).${NC}"
    fi
    
    echo -e "${GREEN}Installing dependencies...${NC}"
    # Rebuild SQLite3 from source
    npm rebuild sqlite3 --build-from-source
    # Then install other dependencies, including canvas which should now build correctly
    npm install --omit=optional
    
    # Ask if voice functionality is needed
    echo -e "${YELLOW}Do you want to install voice functionality? (y/n)${NC}"
    read -r install_voice
    if [[ "$install_voice" == "y" || "$install_voice" == "Y" ]]; then
        echo -e "${GREEN}Installing voice dependencies...${NC}"
        npm run voice:install
    else
        echo -e "${YELLOW}Voice functionality will be disabled.${NC}"
    fi
    
    # Run installation check
    echo -e "${GREEN}Checking installation...${NC}"
    node install-test.js
}

# Function to start the bot
start_bot() {
    echo -e "${GREEN}Starting the bot...${NC}"
    
    # Ask if PM2 should be used
    echo -e "${YELLOW}Do you want to run the bot with PM2? (y/n)${NC}"
    read -r use_pm2
    
    if [[ "$use_pm2" == "y" || "$use_pm2" == "Y" ]]; then
        if ! command -v pm2 &> /dev/null; then
            echo -e "${YELLOW}PM2 is not installed. Installing PM2...${NC}"
            npm install -g pm2
        fi
        
        echo -e "${GREEN}Starting with PM2...${NC}"
        npm run start:pm2
        
        echo -e "${GREEN}Bot is running with PM2. Use 'npm run logs:pm2' to view logs.${NC}"
        echo -e "${YELLOW}To ensure PM2 starts on system boot, you may need to run:${NC}"
        echo -e "${GREEN}pm2 startup${NC}"
        echo -e "${GREEN}pm2 save${NC}"
    else
        echo -e "${GREEN}Starting normally...${NC}"
        npm start
    fi
}

# Main deployment process
echo -e "${GREEN}Checking configuration...${NC}"
check_config

echo -e "${GREEN}Checking for updates...${NC}"
git pull

install_deps

# Create logs directory if it doesn't exist
if [ ! -d "logs" ]; then
    echo -e "${YELLOW}Creating logs directory...${NC}"
    mkdir -p logs
fi

echo -e "${YELLOW}Installation complete. You can verify the installation at any time by running:${NC}"
echo -e "${GREEN}npm run check-install${NC}"

echo -e "${YELLOW}Ready to start the bot? (y/n)${NC}"
read -r start_now
if [[ "$start_now" == "y" || "$start_now" == "Y" ]]; then
    start_bot
else
    echo -e "${GREEN}You can start the bot later by running:${NC}"
    echo -e "${GREEN}npm start${NC}"
    echo -e "${GREEN}or${NC}"
    echo -e "${GREEN}npm run start:pm2${NC}"
fi

echo -e "${GREEN}Deployment complete!${NC}" 