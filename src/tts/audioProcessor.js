import { createAudioPlayer, createAudioResource, joinVoiceChannel, getVoiceConnection, AudioPlayerStatus } from '@discordjs/voice';
import fetch from 'node-fetch';

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

        // Create audio player and resource
        const player = createAudioPlayer();
        const resource = createAudioResource(audioData);
        
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

        if (!response.ok) {
            console.error('TTS API error:', await response.text());
            return null;
        }

        return Buffer.from(await response.arrayBuffer());
    } catch (error) {
        console.error('Error generating speech:', error);
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
        // Using a free TTS service as fallback
        const voiceName = 'Brian';
        const url = `https://api.streamelements.com/kappa/v2/speech?voice=${encodeURIComponent(voiceName)}&text=${encodeURIComponent(text)}`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
            console.error('Free TTS API error:', await response.text());
            return null;
        }
        
        return Buffer.from(await response.arrayBuffer());
    } catch (error) {
        console.error('Error generating free TTS:', error);
        return null;
    }
} 