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

### Requirements
- Node.js >= 16.9.0
- SQLite3
- Discord Bot Token

### Installation
1. Clone the repository:
```bash
git clone https://github.com/yourusername/neurobalbes-discord.git
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

### Требования
- Node.js >= 16.9.0
- SQLite3
- Discord Bot Token

### Установка
1. Клонируйте репозиторий:
```bash
git clone https://github.com/yourusername/neurobalbes-discord.git
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
