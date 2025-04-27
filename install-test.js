#!/usr/bin/env node

// This script checks if all necessary dependencies are correctly installed

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { promises as fs } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('Neurobalbes Discord Bot - Installation Test');
console.log('===========================================');

async function checkCore() {
  try {
    console.log('Checking core dependencies...');
    
    // Discord.js
    const { Client, GatewayIntentBits } = await import('discord.js');
    console.log('✅ discord.js is correctly installed');
    
    // SQLite
    const sqlite = await import('sqlite');
    const sqlite3 = await import('sqlite3');
    console.log('✅ sqlite and sqlite3 are correctly installed');
    
    // Winston
    const winston = await import('winston');
    console.log('✅ winston is correctly installed');
    
    // Node-fetch
    const fetch = await import('node-fetch');
    console.log('✅ node-fetch is correctly installed');
    
    return true;
  } catch (error) {
    console.error('❌ Error checking core dependencies:', error.message);
    return false;
  }
}

async function checkVoice() {
  try {
    console.log('\nChecking voice dependencies...');
    
    // Check voice module
    try {
      const voice = await import('@discordjs/voice');
      console.log('✅ @discordjs/voice is correctly installed');
    } catch (error) {
      console.log('❌ @discordjs/voice is not installed:', error.message);
      return false;
    }
    
    // Check opus
    try {
      const opus = await import('@discordjs/opus');
      console.log('✅ @discordjs/opus is correctly installed');
    } catch (error) {
      console.log('❌ @discordjs/opus is not installed:', error.message);
      return false;
    }
    
    // Check libsodium
    try {
      const sodium = await import('libsodium-wrappers');
      console.log('✅ libsodium-wrappers is correctly installed');
    } catch (error) {
      console.log('❌ libsodium-wrappers is not installed:', error.message);
      return false;
    }
    
    // Check ffmpeg
    try {
      const ffmpeg = await import('ffmpeg-static');
      console.log('✅ ffmpeg-static is correctly installed');
    } catch (error) {
      console.log('❌ ffmpeg-static is not installed:', error.message);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error checking voice dependencies:', error.message);
    return false;
  }
}

async function checkConfig() {
  try {
    console.log('\nChecking configuration...');
    
    // Check if config.json exists
    try {
      await fs.access('config.json');
      console.log('✅ config.json exists');
      
      // Check if token is set
      const config = JSON.parse(await fs.readFile('config.json', 'utf8'));
      if (config.token && config.token !== 'YOUR_BOT_TOKEN_HERE') {
        console.log('✅ Bot token is set');
      } else {
        console.log('❌ Bot token is not set');
      }
      
      if (config.clientId && config.clientId !== 'YOUR_CLIENT_ID_HERE') {
        console.log('✅ Client ID is set');
      } else {
        console.log('❌ Client ID is not set');
      }
    } catch (error) {
      console.log('❌ config.json not found or invalid');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error checking configuration:', error.message);
    return false;
  }
}

async function runTests() {
  const coreOk = await checkCore();
  const voiceOk = await checkVoice();
  const configOk = await checkConfig();
  
  console.log('\nTest Results:');
  console.log('=============');
  console.log(`Core dependencies: ${coreOk ? '✅ OK' : '❌ Failed'}`);
  console.log(`Voice dependencies: ${voiceOk ? '✅ OK' : '❌ Not installed (optional)'}`);
  console.log(`Configuration: ${configOk ? '✅ OK' : '❌ Issues found'}`);
  
  if (!voiceOk) {
    console.log('\nVoice dependencies are not installed. To install them, run:');
    console.log('npm run voice:install');
  }
  
  if (!configOk) {
    console.log('\nPlease update your config.json file or create one using the template from README.md');
  }
  
  if (coreOk && (voiceOk || true) && configOk) {
    console.log('\n✅ All critical checks passed. The bot should be ready to run!');
  } else {
    console.log('\n❌ Some issues were found. Please fix them before running the bot.');
  }
}

runTests().catch(console.error); 