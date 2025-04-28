import winston from 'winston';
import path from 'path';
import fs from 'fs';

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Get calling module information for better context
function getCallerInfo() {
    const stackLines = new Error().stack.split('\n');
    // Skip first 3 lines (Error, getCallerInfo, log function)
    const callerLine = stackLines[3] || '';
    
    let callerInfo = '[unknown]';
    try {
        // Extract file path and line number
        const match = callerLine.match(/at\s+(.*?)\s+\((.*?):(\d+):(\d+)\)/);
        if (match) {
            const [, functionName, filePath, line] = match;
            const fileName = path.basename(filePath);
            callerInfo = `[${fileName}:${line}|${functionName}]`;
        } else {
            // Alternative format without function
            const altMatch = callerLine.match(/at\s+(.*?):(\d+):(\d+)/);
            if (altMatch) {
                const [, filePath, line] = altMatch;
                const fileName = path.basename(filePath);
                callerInfo = `[${fileName}:${line}]`;
            }
        }
    } catch (e) {
        // Fallback if parsing fails
    }
    
    return callerInfo;
}

// Custom format that includes caller information
const customFormat = winston.format.printf(({ level, message, timestamp, ...meta }) => {
    // Add caller info to all log lines except those that already contain a context
    const contextInfo = meta.context || getCallerInfo();
    
    // Format error objects nicely
    let formattedMessage = message;
    if (meta.error) {
        if (typeof meta.error === 'object' && meta.error.stack) {
            formattedMessage += `\n${meta.error.stack}`;
        } else {
            formattedMessage += ` ${meta.error}`;
        }
    }
    
    // Create the formatted log message
    return `${timestamp} [${level.toUpperCase()}] ${contextInfo}: ${formattedMessage}`;
});

// Create logger instance
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        customFormat
    ),
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.timestamp(),
                customFormat
            )
        }),
        new winston.transports.File({ 
            filename: path.join(logsDir, 'error.log'), 
            level: 'error' 
        }),
        new winston.transports.File({ 
            filename: path.join(logsDir, 'combined.log')
        })
    ]
});

// Add shard ID information if available
let shardInfo = process.env.SHARD_ID ? `Shard ${process.env.SHARD_ID}` : 'Main';

// Enhanced logging functions with better context
export default {
    error: (message, error) => {
        logger.error(message, { error, context: `[${shardInfo}]` });
    },
    
    warn: (message, details) => {
        logger.warn(message, { ...(details ? { details } : {}), context: `[${shardInfo}]` });
    },
    
    info: (message, details) => {
        logger.info(message, { ...(details ? { details } : {}), context: `[${shardInfo}]` });
    },
    
    debug: (message, details) => {
        logger.debug(message, { ...(details ? { details } : {}), context: `[${shardInfo}]` });
    },
    
    command: (commandName, guildId, userId, status, details) => {
        logger.info(`Command ${commandName} ${status}`, { 
            command: commandName,
            guild: guildId,
            user: userId,
            status,
            ...(details ? { details } : {}),
            context: `[${shardInfo}|CMD]`
        });
    },
    
    interaction: (type, status, guildId, details) => {
        logger.info(`Interaction ${type} ${status}`, {
            type,
            guild: guildId,
            status,
            ...(details ? { details } : {}),
            context: `[${shardInfo}|INT]` 
        });
    },
    
    // Set shard ID (call when shard ID is known)
    setShardId: (id) => {
        shardInfo = `Shard ${id}`;
    }
}; 