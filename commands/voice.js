const voice = require('@discordjs/voice')
const { SlashCommandBuilder } = require('discord.js');
const { answers } = require('../assets/answers');
const { languages } = require('../assets/descriptions');
const { getChat } = require('../database')
const { getLocale } = require('../functions');
const Markov  = require('../markov.js')

const STREAM_ELEMENTS_API_BASE = 'https://api.streamelements.com/kappa/v2/speech';
const DEFAULT_VOICE = 'Maxim';
const INSUFFICIENT_DATA_WARNING = 'Недостаточно данных для генерации...\nНапишите что-нибудь в чат';

// Helper to generate filtered text
function generateFilteredText(chain) {
    let text = chain.generate_low();
    // Simpler filter using regex might be more robust, but keeping original logic for now
    while (text && /[http/@/]/.test(text)) {
        text = chain.generate_low();
    }
    return text;
}

// Helper to create StreamElements speech URL
function createSpeechUrl(text, voiceName = DEFAULT_VOICE) {
    return `${STREAM_ELEMENTS_API_BASE}?voice=${encodeURIComponent(voiceName)}&text=${encodeURIComponent(text)}`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('voice')
        .setDescription(languages.voice.main['en-US'])
        .setDescriptionLocalizations(languages.voice.main)
        .addStringOption(option =>
            option.setName('action')
                .setDescription(languages.voice.action['en-US'])
                .setDescriptionLocalizations(languages.voice.action)
                .setRequired(true)
                .addChoices(
                    { name: languages.voice.connect['en-US'], value: 'connect', name_localizations: languages.voice.connect },
                    { name: languages.voice.disconnect['en-US'], value: 'disconnect', name_localizations: languages.voice.disconnect }
                )),
    async execute(interaction) {
        if (!interaction.guildId) return;
        
        await interaction.reply({ content: '⏳', ephemeral: true });

        const action = interaction.options.getString('action');
        let chat;
        try {
            chat = await getChat(interaction.guildId);
        } catch (dbError) {
            console.error("Database error fetching chat:", dbError);
            await interaction.editReply({ content: getLocale(answers, 'common', 'database_error', 'en-US') });
            return;
        }
        const lang = chat?.lang || 'en-US';

        if (action === 'connect') {
            try {
                const member = interaction.guild.members.cache.get(interaction.user.id);

                if (!member?.voice?.channel) {
                    await interaction.editReply({ content: getLocale(answers, 'voice', 'notinvoice', lang) });
                    return;
                }

                const connection = voice.joinVoiceChannel({
                    channelId: member.voice.channel.id,
                    guildId: interaction.guild.id,
                    adapterCreator: interaction.guild.voiceAdapterCreator,
                    selfDeaf: false
                });

                connection.on(voice.VoiceConnectionStatus.Ready, () => {
                     console.log(`Voice connection ready for guild ${interaction.guildId}`);
                     interaction.editReply({ content: getLocale(answers, 'voice', 'start_voice', lang, member.voice.channel.name) });
                });

                connection.on(voice.VoiceConnectionStatus.Disconnected, async (oldState, newState) => {
					try {
						await Promise.race([
							voice.entersState(connection, voice.VoiceConnectionStatus.Signalling, 5_000),
							voice.entersState(connection, voice.VoiceConnectionStatus.Connecting, 5_000),
						]);
						// Seems like it is reconnecting to a new channel - ignore disconnect
					} catch (error) {
						// Seems like it disconnected - destroy connection
                        console.log(`Voice connection disconnected for guild ${interaction.guildId}, destroying.`);
						if (connection.state.status !== voice.VoiceConnectionStatus.Destroyed) {
                            connection.destroy();
                        }
					}
				});

                connection.on(voice.VoiceConnectionStatus.Destroyed, () => {
                    console.log(`Voice connection destroyed for guild ${interaction.guildId}`);
                });

                 connection.on(voice.VoiceConnectionStatus.Errored, error => {
                    console.error(`Voice connection error for guild ${interaction.guildId}:`, error);
                    // Optionally notify user or try to handle
                });

                const text_lines = chat?.textbase?.length || 0;
                let chain = null;
                if (text_lines > 0) {
                    try {
                         chain = new Markov(chat.textbase.join(' '));
                    } catch (markovError) {
                        console.error(`Failed to initialize Markov chain for guild ${interaction.guildId}:`, markovError)
                        // Bot can still connect, but generation might fail
                    }
                }

                connection.receiver.speaking.on('start', async (userId) => {
                    if (interaction.user.id !== userId || !chain || text_lines < 1) return;

                    if (Math.random() < 0.5) {
                        let generatedText = generateFilteredText(chain);

                        if (!generatedText) {
                             console.log(`Markov chain generated empty text for guild ${interaction.guildId}`);
                             return;
                        }

                        const streamUrl = createSpeechUrl(generatedText);
                        let audioResource;
                        try {
                             audioResource = voice.createAudioResource(streamUrl);
                        } catch (resourceError){
                            console.error(`Failed to create audio resource for guild ${interaction.guildId}:`, resourceError);
                            return;
                        }

                        const audioPlayer = new voice.AudioPlayer({
                             behaviors: {
                                 noSubscriber: voice.NoSubscriberBehavior.Pause,
                             },
                        });

                        audioPlayer.on('error', error => {
                            console.error(`AudioPlayer Error for guild ${interaction.guildId}: ${error.message}`);
                            if(subscription) {
                                try { subscription.unsubscribe(); } catch {}
                            }
                        });

                        const subscription = connection.subscribe(audioPlayer);

                        if (subscription) {
                            audioPlayer.play(audioResource);
                            const timeoutId = setTimeout(() => {
                                try {
                                    if (subscription && !subscription.connection.destroyed) {
                                         subscription.unsubscribe();
                                         console.log(`Unsubscribed audio player after timeout for guild ${interaction.guildId}`);
                                     }
                                 } catch (unsubError) {
                                     console.error(`Error unsubscribing player for guild ${interaction.guildId}:`, unsubError);
                                 }
                             }, 5_000);

                            audioPlayer.on(voice.AudioPlayerStatus.Idle, () => {
                                clearTimeout(timeoutId);
                                 try {
                                     if (subscription && !subscription.connection.destroyed) {
                                         subscription.unsubscribe();
                                         console.log(`Unsubscribed audio player on Idle for guild ${interaction.guildId}`);
                                     }
                                 } catch (unsubError) {
                                     console.error(`Error unsubscribing player on Idle for guild ${interaction.guildId}:`, unsubError);
                                 }
                            });

                        } else {
                            console.log(`Failed to subscribe audio player for guild ${interaction.guildId}`);
                        }
                    }
                });

            } catch (error) {
                console.error(`Error in voice connect for guild ${interaction.guildId}:`, error);
                try {
                    await interaction.editReply({ content: getLocale(answers, 'common', 'general_error', lang) });
                } catch (replyError) {
                    console.error("Failed to send error reply:", replyError);
                }
                 const connection = voice.getVoiceConnection(interaction.guild.id);
                 if (connection && connection.state.status !== voice.VoiceConnectionStatus.Destroyed) {
                     connection.destroy();
                 }
            }
        } else if (action === 'disconnect') {
            try {
                const connection = voice.getVoiceConnection(interaction.guild.id);

                if (!connection) {
                    await interaction.editReply({ content: getLocale(answers, 'voice', 'iam_notinvoice', lang) });
                    return;
                }

                 const member = interaction.guild.members.cache.get(interaction.user.id);

                 connection.destroy();
                 console.log(`Voice connection destroyed via command for guild ${interaction.guildId}`);

                 const channelName = member?.voice?.channel?.name;

                await interaction.editReply({ content: getLocale(answers, 'voice', 'disconnect', lang, channelName || 'the channel') });
            } catch (error) {
                console.error(`Error in voice disconnect for guild ${interaction.guildId}:`, error);
                 try {
                    await interaction.editReply({ content: getLocale(answers, 'common', 'general_error', lang) });
                } catch (replyError) {
                    console.error("Failed to send error reply:", replyError);
                }
            }
        }
    },
};
