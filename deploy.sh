#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}Starting Neurobalbes Discord Bot deployment...${NC}"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js is not installed. Please install Node.js version 16.9.0 or higher.${NC}"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2)
if [ "$(printf '%s\n' "16.9.0" "$NODE_VERSION" | sort -V | head -n1)" = "16.9.0" ]; then
    echo -e "${GREEN}Node.js version $NODE_VERSION is compatible.${NC}"
else
    echo -e "${RED}Node.js version must be 16.9.0 or higher. Current version: $NODE_VERSION${NC}"
    exit 1
fi

# Function to check if running on Apple Silicon
is_apple_silicon() {
    if [[ "$(uname -m)" == "arm64" ]]; then
        return 0
    else
        return 1
    fi
}

# Function to install dependencies with special handling for Apple Silicon
install_dependencies() {
    if is_apple_silicon; then
        echo -e "${YELLOW}Detected Apple Silicon (M1/M2). Using alternative dependencies...${NC}"
        # Remove @discordjs/opus from package.json as it's not needed for basic functionality
        sed -i '' '/"@discordjs\/opus"/d' package.json
        # Install dependencies without optional dependencies
        npm install --no-optional
    else
        npm install
    fi
}

# Check if node_modules exists and package.json hasn't been modified
if [ -d "node_modules" ]; then
    PACKAGE_JSON_MODIFIED=$(find package.json -newer node_modules -print 2>/dev/null)
    if [ -z "$PACKAGE_JSON_MODIFIED" ]; then
        echo -e "${GREEN}Dependencies are already installed and up to date.${NC}"
    else
        echo -e "${YELLOW}package.json has been modified. Updating dependencies...${NC}"
        install_dependencies
        if [ $? -ne 0 ]; then
            echo -e "${RED}Failed to update dependencies.${NC}"
            exit 1
        fi
    fi
else
    echo -e "${YELLOW}Installing dependencies...${NC}"
    install_dependencies
    if [ $? -ne 0 ]; then
        echo -e "${RED}Failed to install dependencies.${NC}"
        exit 1
    fi
fi

# Check if config.json exists
if [ ! -f "config.json" ]; then
    echo -e "${RED}config.json not found. Creating from example...${NC}"
    if [ -f "config.example.json" ]; then
        cp config.example.json config.json
        echo -e "${GREEN}Created config.json. Please edit it with your bot token and settings.${NC}"
        echo -e "${YELLOW}Please edit config.json before continuing.${NC}"
        exit 1
    else
        echo -e "${RED}config.example.json not found. Please create config.json manually.${NC}"
        exit 1
    fi
fi

# Try to install PM2 globally with sudo if needed
install_pm2() {
    if ! command -v pm2 &> /dev/null; then
        echo -e "${YELLOW}Installing PM2 globally...${NC}"
        if npm install -g pm2; then
            echo -e "${GREEN}PM2 installed successfully.${NC}"
        else
            echo -e "${YELLOW}Trying to install PM2 with sudo...${NC}"
            if sudo npm install -g pm2; then
                echo -e "${GREEN}PM2 installed successfully with sudo.${NC}"
            else
                echo -e "${RED}Failed to install PM2. Please install it manually:${NC}"
                echo -e "${YELLOW}sudo npm install -g pm2${NC}"
                exit 1
            fi
        fi
    else
        echo -e "${GREEN}PM2 is already installed.${NC}"
    fi
}

install_pm2

# Create logs directory if it doesn't exist
mkdir -p logs

# Start the bot with PM2
echo -e "${GREEN}Starting bot with PM2...${NC}"
pm2 start src/core/shard.js --name neurobalbes --log logs/app.log --time

if [ $? -eq 0 ]; then
    echo -e "${GREEN}Bot has been successfully deployed!${NC}"
    echo -e "\nUse the following commands to manage the bot:"
    echo -e "  ${GREEN}pm2 logs neurobalbes${NC} - View bot logs"
    echo -e "  ${GREEN}pm2 stop neurobalbes${NC} - Stop the bot"
    echo -e "  ${GREEN}pm2 restart neurobalbes${NC} - Restart the bot"
    echo -e "  ${GREEN}pm2 monit${NC} - Monitor bot performance"
    
    # Save PM2 process list
    echo -e "\n${YELLOW}Saving PM2 process list...${NC}"
    pm2 save
    
    # Generate startup script
    echo -e "${YELLOW}Setting up PM2 startup script...${NC}"
    pm2 startup | tail -n 1
else
    echo -e "${RED}Failed to start the bot.${NC}"
    exit 1
fi 