const voice = require('@discordjs/voice')
const { SlashCommandBuilder } = require('discord.js');
const { answers } = require('../assets/answers');
const { languages } = require('../assets/descriptions');
const { getChat } = require('../database')
const { choice, getLocale } = require('../functions');
const Markov  = require('../markov.js')

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
        
        await interaction.reply({ content: '⏳' });

        const action = interaction.options.getString('action');
        const chat = await getChat(interaction.guildId);

        if (action === 'connect') {
            try {
                const member = interaction.guild.members.cache.get(interaction.user.id);

                if (!member.voice.channel) {
                    await interaction.editReply({ content: getLocale(answers, 'voice', 'notinvoice', chat.lang) });
                    return;
                }

                const connection = voice.joinVoiceChannel({
                    channelId: member.voice.channel.id,
                    guildId: interaction.guild.id,
                    adapterCreator: interaction.guild.voiceAdapterCreator,
                    selfDeaf: false
                });

                const text_lines = chat['textbase'].length;
                const chain = new Markov(chat.textbase.join(' '));

                connection.receiver.speaking.on('start', async (speaker) => {
                    if (interaction.user.id === speaker) {
                        const integers = [1, 2];
                        const randoms = choice(integers);
                        const x = choice(integers);

                        if (x === randoms) {
                            let text = chain.generate_low();

                            while (text && (text.includes('http') || text.includes('/') || text.includes('@'))) {
                                text = chain.generate_low();
                            }

                            const with_text = `https://api.streamelements.com/kappa/v2/speech?voice=${encodeURIComponent('Maxim')}&text=${encodeURIComponent(text)}`;
                            const warning = `https://api.streamelements.com/kappa/v2/speech?voice=${encodeURIComponent('Maxim')}&text=${encodeURIComponent('Недостаточно данных для генерации...\nНапишите что-нибудь в чат')}`;

                            const stream = (text_lines >= 1) ? with_text : warning;
                            const audioResource = voice.createAudioResource(stream);

                            const audioPlayer = new voice.AudioPlayer();
                            const subscription = connection.subscribe(audioPlayer);

                            if (subscription) {
                                audioPlayer.play(audioResource);
                                setTimeout(() => subscription.unsubscribe(), 5_000);
                            }
                        }
                    }
                });

                await interaction.editReply({ content: getLocale(answers, 'voice', 'start_voice', chat.lang, member.voice.channel.name) });
            } catch (error) {
                console.error(error);
            }
        } else if (action === 'disconnect') {
            try {
                const connection = voice.getVoiceConnection(interaction.guild.id);

                if (!connection) {
                    await interaction.editReply({ content: getLocale(answers, 'voice', 'iam_notinvoice', chat.lang) });
                    return;
                }

                connection.destroy();
                const member = interaction.guild.members.cache.get(interaction.user.id);
                
                await interaction.editReply({ content: getLocale(answers, 'voice', 'disconnect', chat.lang, member.voice.channel?.name) });
            } catch (error) {
                console.error(error);
            }
        }
    },
};
