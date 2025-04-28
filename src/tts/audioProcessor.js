import { createAudioPlayer, createAudioResource, joinVoiceChannel, getVoiceConnection, AudioPlayerStatus } from '@discordjs/voice';
import fetch from 'node-fetch';
import { Readable } from 'node:stream';
import logger from '../utils/logger.js';

// Voice API configuration
const API_URL = 'https://api.elevenlabs.io/v1/text-to-speech';
const API_KEY = process.env.ELEVENLABS_API_KEY;
const DEFAULT_VOICE_ID = 'pNInz6obpgDQGcFmaJgB'; // Default ElevenLabs voice ID

/**
 * Process audio from text and play in voice channel
 * @param {string} text - The text to convert to speech
 * @param {Object} voiceChannel - The voice channel to join
 * @param {Object} interaction - The Discord interaction
 * @returns {Object} Result of the operation
 */
export async function processAudio(text, voiceChannel, interaction) {
    try {
        // Create connection to voice channel
        const connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: voiceChannel.guild.id,
            adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        });

        // Get audio data from TTS service
        const audioData = await generateSpeech(text);
        
        if (!audioData) {
            return { 
                success: false, 
                error: 'Failed to generate speech. Please try again later.' 
            };
        }

        // Convert Buffer to Readable stream
        const audioStream = Readable.from(audioData);

        // Create audio player and resource
        const player = createAudioPlayer();
        const resource = createAudioResource(audioStream);
        
        connection.subscribe(player);
        player.play(resource);

        // Handle player state changes
        return new Promise((resolve) => {
            player.on(AudioPlayerStatus.Idle, () => {
                // Disconnect after playing
                setTimeout(() => {
                    const conn = getVoiceConnection(voiceChannel.guild.id);
                    if (conn) conn.destroy();
                }, 2000);
                
                resolve({ success: true });
            });
            
            player.on('error', (error) => {
                console.error('Error playing audio:', error);
                const conn = getVoiceConnection(voiceChannel.guild.id);
                if (conn) conn.destroy();
                
                resolve({ 
                    success: false, 
                    error: 'Error playing audio. Please try again later.' 
                });
            });
        });
    } catch (error) {
        console.error('Error in processAudio:', error);
        return { 
            success: false, 
            error: 'Failed to process audio. Please try again later.' 
        };
    }
}

/**
 * Generate speech using the TTS API
 * @param {string} text - The text to convert to speech
 * @returns {Buffer|null} Audio data as buffer or null if failed
 */
async function generateSpeech(text) {
    try {
        // Fallback to a free TTS API if no API key is provided
        if (!API_KEY) {
            return generateFreeTTS(text);
        }

        // Use ElevenLabs
        logger.info('[generateSpeech] Using ElevenLabs API...');
        const response = await fetch(`${API_URL}/${DEFAULT_VOICE_ID}`, {
            method: 'POST',
            headers: {
                'xi-api-key': API_KEY,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text,
                model_id: 'eleven_multilingual_v2',
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.5,
                }
            }),
        });

        // Log Response Headers
        logger.info('[generateSpeech] ElevenLabs Response Headers:', { 
            status: response.status,
            contentType: response.headers.get('content-type')
        });

        if (!response.ok) {
            logger.error('ElevenLabs TTS API error:', { status: response.status, text: await response.text() });
            return null;
        }

        const audioBuffer = Buffer.from(await response.arrayBuffer());
        // Log Buffer Snippet
        logger.info('[generateSpeech] ElevenLabs Audio Buffer Snippet:', { 
            length: audioBuffer.length,
            snippetHex: audioBuffer.slice(0, 16).toString('hex') // First 16 bytes as hex
        });
        return audioBuffer;
    } catch (error) {
        logger.error('Error in generateSpeech:', { error: error?.message || error });
        return null;
    }
}

/**
 * Fallback to a free TTS service
 * @param {string} text - The text to convert to speech
 * @returns {Buffer|null} Audio data as buffer or null if failed
 */
async function generateFreeTTS(text) {
    try {
        logger.info('[generateFreeTTS] Using StreamElements fallback API...');
        const voiceName = 'Brian';
        const url = `https://api.streamelements.com/kappa/v2/speech?voice=${encodeURIComponent(voiceName)}&text=${encodeURIComponent(text)}`;
        
        const response = await fetch(url);

        // Log Response Headers
        logger.info('[generateFreeTTS] StreamElements Response Headers:', { 
            status: response.status,
            contentType: response.headers.get('content-type')
        });
        
        if (!response.ok) {
            logger.error('Free TTS API error:', { status: response.status, text: await response.text() });
            return null;
        }
        
        const audioBuffer = Buffer.from(await response.arrayBuffer());
        // Log Buffer Snippet
        logger.info('[generateFreeTTS] StreamElements Audio Buffer Snippet:', { 
            length: audioBuffer.length,
            snippetHex: audioBuffer.slice(0, 16).toString('hex') // First 16 bytes as hex
        });
        return audioBuffer;
    } catch (error) {
        logger.error('Error generating free TTS:', { error: error?.message || error });
        return null;
    }
} 