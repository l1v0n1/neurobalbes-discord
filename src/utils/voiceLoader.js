/**
 * Conditional Voice Module Loader
 * This utility allows the bot to function without voice capabilities 
 * if the optional voice dependencies aren't installed.
 */

let voiceAvailable = false;
let voiceModule = null;
let opus = null;
let sodium = null;
let ffmpeg = null;

// Try to load voice dependencies
try {
  voiceModule = await import('@discordjs/voice');
  opus = await import('@discordjs/opus');
  sodium = await import('libsodium-wrappers');
  
  try {
    ffmpeg = await import('ffmpeg-static');
  } catch (ffmpegError) {
    console.warn('FFmpeg not available:', ffmpegError.message);
    console.warn('Some voice features may not work properly');
  }
  
  // Check if sodium is ready (required by voice v0.18.0)
  await sodium.default.ready;
  
  voiceAvailable = true;
  console.log('Voice dependencies loaded successfully');
} catch (error) {
  console.warn('Voice dependencies not available:', error.message);
  console.warn('Voice features will be disabled. Install with: npm run voice:install');
}

/**
 * Checks if voice functionality is available
 * @returns {boolean} Whether voice dependencies are loaded
 */
export function isVoiceAvailable() {
  return voiceAvailable;
}

/**
 * Gets voice module if available
 * @returns {object|null} The voice module or null if not available
 */
export function getVoiceModule() {
  return voiceModule;
}

/**
 * Gets opus module if available
 * @returns {object|null} The opus module or null if not available
 */
export function getOpus() {
  return opus;
}

/**
 * Gets sodium module if available
 * @returns {object|null} The sodium module or null if not available
 */
export function getSodium() {
  return sodium;
}

/**
 * Gets ffmpeg module if available
 * @returns {object|null} The ffmpeg module or null if not available
 */
export function getFFmpeg() {
  return ffmpeg;
}

export default {
  isVoiceAvailable,
  getVoiceModule,
  getOpus,
  getSodium,
  getFFmpeg
}; 