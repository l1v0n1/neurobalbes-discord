# Neurobalbes Discord Bot

An advanced Discord bot using Markov chains for message generation.

## Setup to run directly on the OS

1. Clone the repository:
   ```
   git clone https://github.com/l1v0n1/neurobalbes-discord.git
   cd neurobalbes-discord
   ```

2. Install dependencies:
   ```
   npm install --omit=optional
   ```

3. For voice functionality (optional):
   ```
   npm run voice:install
   ```
   This command installs the required dependencies for voice features: `@discordjs/voice`, `@discordjs/opus`, and `ffmpeg-static`.
   
   If you encounter errors, ensure you have Python and a C++ build toolchain installed (see prerequisites below). For troubleshooting, see the "Voice Features Troubleshooting" section at the end of this README.

4. Create a config.json file:
   ```json
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
   ```

5. Verify your installation:
   ```
   npm run check-install
   ```

6. Start the bot:
   ```
   npm start
   ```

For development:
   ```
   npm run dev
   ```

### Quick Start with Deployment Script

You can also use the provided deployment script which will guide you through the setup process:

```bash
chmod +x deploy.sh
./deploy.sh
```

The script will:
1. Check if your configuration is valid
2. Install dependencies
3. Install voice dependencies if requested
4. Verify the installation
5. Start the bot with your preferred method (normal or PM2)

## Docker setup 

> :information_source: The image is not supplied by the original developer. If you encounter any issues with it, address them to https://github.com/kuper-dot/neurobalbes-discord. 
>
> The docker image does not support voice functionality (yet)

### Method 1: Using unofficial image (Easiest)

Use the provided docker compose file to deploy the bot using the docker GUI of your choice

> :warning: Don't forget to change the environmental variables!

   ```yml
   version: '3.8'
   services:
   neurobalbes-bot:
      image: kuperdot/neurobalbes-discord:latest
      container_name: neurobalbes-bot
      volumes:
         - balbes-data:/app/data
      environment:
         BOT_TOKEN: your-bot-token
         PREFIX: /
         BOT_DESCRIPTION: 'Neurobalbes | Type /help for commands'
         CLIENT_ID: your-bot-client-id
         RAW_LIMIT: 2000
         INVITE_LINK: your-invite-link
         SERVER_LINK: your-server-link
         ADMIN_ID: 123456789 # Replace with your discord user ID
         SITE: https://www.youtube.com/watch?v=dQw4w9WgXcQ # Replace with your site URL
      command: ["npm", "start"]

   volumes:
   balbes-data:
   ```


**If you don't use the GUI you can:**

1. Download docker-compose.yml
   ```bash
   wget https://raw.githubusercontent.com/l1v0n1/neurobalbes-discord/main/docker-compose.yml
   ```

2. Modify the file to include proper varibles

3. Run:
   ```bash
   docker-compose up -d
   ```


### Method 2: Build the image manually

1. Clone the repository:
   ```
   git clone https://github.com/l1v0n1/neurobalbes-discord.git
   cd neurobalbes-discord
   ```

2. Build the image using provided dockerfile
   ```bash
   docker build -t neurobalbes-discord .
   ```

3. Use the following command to deploy the image
   ```bash
   docker run -d \
   --name neurobalbes-bot \
   -v balbes-data:/app/data \
   -e BOT_TOKEN=your-bot-token \
   -e PREFIX=/ \
   -e BOT_DESCRIPTION='Neurobalbes | Type /help for commands' \
   -e CLIENT_ID=your-bot-client-id \
   -e RAW_LIMIT=2000 \
   -e INVITE_LINK=your-invite-link \
   -e SERVER_LINK=your-server-link \
   -e ADMIN_ID=123456789 \
   -e SITE=your-website \
   neurobalbes-discord
   ```
  
## Commands

- **/help** - Shows available commands
- **/gen** - Generates a message using Markov chains
- **/gendem** - Generates a message with different settings
- **/continue** - Continues a message thread
- **/voice** - Voice channel interactions (requires voice dependencies)
- **/setting** - Configure bot settings
- **/language** - Change bot language
- **/delete** - Delete learned data
- **/stats** - View bot statistics
- **/info** - Get bot information
- **/shards** - View shard information

## Requirements

- Node.js 16.9.0 or higher

## License

MIT

[English](#english) | [Русский](#русский)

## English

### Overview
Neurobalbes is an advanced Discord bot that uses Markov chains to generate messages based on server chat history. It learns from conversations and can generate contextually relevant responses.

### Features
- Message learning and generation using Markov chains
- Multi-server support with sharding
- Customizable response frequency
- Support for images and attachments
- Multiple language support
- Efficient database management
- Auto-recovery from disconnections

### Prerequisites

- Node.js v16.9.0 or higher
- SQLite3
- Discord Bot Token

### Platform-Specific Requirements

Before installing dependencies, make sure you have the following prerequisites installed for your operating system:

#### Windows
1. Install [Node.js](https://nodejs.org/) (v16.9.0 or higher)
2. Install [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
   - During installation, select "Desktop development with C++"
   - This is required for compiling native modules

#### macOS
1. Install [Node.js](https://nodejs.org/) (v16.9.0 or higher)
2. Install Xcode Command Line Tools:
   ```bash
   xcode-select --install
   ```
3. Install Opus (required for voice support):
   ```bash
   brew install opus
   ```

#### Linux (Ubuntu/Debian)
1. Install Node.js (v16.9.0 or higher)
2. Install required build tools and libraries:
   ```bash
   sudo apt-get update
   sudo apt-get install build-essential python3 libtool-bin
   sudo apt-get install libopus-dev
   ```

After installing the prerequisites, run:
```bash
npm install
```

### Installation
1. Clone the repository:
```bash
git clone https://github.com/l1v0n1/neurobalbes-discord.git
cd neurobalbes-discord
```

2. Install dependencies:
```bash
npm install
```

3. Configure the bot:
- Rename `config.example.json` to `config.json`
- Add your Discord bot token and other settings

4. Start the bot:
```bash
# Development mode
npm run dev

# Production mode
npm start
```

### Configuration
Edit `config.json` to customize:
- Bot token
- Bot description
- Command prefix
- Message limits
- Admin settings

### Commands
- `/help` - Show available commands
- `/language` - Change bot language
- More commands available in the commands directory

### Project Structure
```
neurobalbes-discord/
├── src/
│   ├── core/           # Core bot functionality
│   ├── database/       # Database operations
│   ├── utils/          # Utility functions
│   └── commands/       # Bot commands
├── assets/            # Static assets
├── config.json        # Bot configuration
└── package.json       # Project dependencies
```

---

## Русский

### Обзор
Neurobalbes - это продвинутый Discord бот, использующий цепи Маркова для генерации сообщений на основе истории чата сервера. Он учится на основе разговоров и может генерировать контекстуально релевантные ответы.

### Возможности
- Обучение и генерация сообщений с использованием цепей Маркова
- Поддержка множества серверов с шардингом
- Настраиваемая частота ответов
- Поддержка изображений и вложений
- Поддержка нескольких языков
- Эффективное управление базой данных
- Автоматическое восстановление после отключений

### Предварительные требования

- Node.js версии 16.9.0 или выше
- SQLite3
- Токен Discord бота

### Требования для разных платформ

Перед установкой зависимостей убедитесь, что у вас установлены следующие компоненты для вашей операционной системы:

#### Windows
1. Установите [Node.js](https://nodejs.org/) (версии 16.9.0 или выше)
2. Установите [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
   - Во время установки выберите "Разработка классических приложений на C++"
   - Это необходимо для компиляции нативных модулей

#### macOS
1. Установите [Node.js](https://nodejs.org/) (версии 16.9.0 или выше)
2. Установите инструменты командной строки Xcode:
   ```bash
   xcode-select --install
   ```
3. Установите Opus (необходим для поддержки голоса):
   ```bash
   brew install opus
   ```

#### Linux (Ubuntu/Debian)
1. Установите Node.js (версии 16.9.0 или выше)
2. Установите необходимые инструменты для сборки и библиотеки:
   ```bash
   sudo apt-get update
   sudo apt-get install build-essential python3 libtool-bin
   sudo apt-get install libopus-dev
   ```

После установки предварительных требований выполните:
```bash
npm install
```

### Установка
1. Клонируйте репозиторий:
```bash
git clone https://github.com/l1v0n1/neurobalbes-discord.git
cd neurobalbes-discord
```

2. Установите зависимости:
```bash
npm install
```

3. Настройте бота:
- Переименуйте `config.example.json` в `config.json`
- Добавьте токен вашего Discord бота и другие настройки

4. Запустите бота:
```bash
# Режим разработки
npm run dev

# Продакшн режим
npm start
```

### Конфигурация
Отредактируйте `config.json` для настройки:
- Токена бота
- Описания бота
- Префикса команд
- Лимитов сообщений
- Настроек администратора

### Команды
- `/help` - Показать доступные команды
- `/language` - Изменить язык бота
- Дополнительные команды доступны в директории commands

### Структура проекта
```
neurobalbes-discord/
├── src/
│   ├── core/           # Основной функционал бота
│   ├── database/       # Операции с базой данных
│   ├── utils/          # Вспомогательные функции
│   └── commands/       # Команды бота
├── assets/            # Статические ресурсы
├── config.json        # Конфигурация бота
└── package.json       # Зависимости проекта
```
