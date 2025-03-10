# Neurobalbes Discord Bot

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
