import { SlashCommandBuilder } from 'discord.js';
import { getLanguage } from '../src/database/methods.js';
import { answers } from '../assets/answers.js';
import { processAudio } from '../src/tts/audioProcessor.js';

export default {
    data: new SlashCommandBuilder()
        .setName('voice')
        .setDescription('Get a voice response from the bot')
        .addStringOption(option => 
            option.setName('prompt')
                .setDescription('What would you like the bot to say?')
                .setRequired(true)),
    
    async execute(interaction) {
        try {
            const guildId = interaction.guild?.id;
            const lang = guildId ? await getLanguage(guildId) : 'en';
            const prompt = interaction.options.getString('prompt');
            
            if (!prompt) {
                return interaction.editReply(answers.voice.no_prompt[lang] || answers.voice.no_prompt.en);
            }
            
            // Check if user is in a voice channel
            const voiceChannel = interaction.member?.voice.channel;
            if (!voiceChannel) {
                return interaction.editReply(answers.voice.not_in_voice[lang] || answers.voice.not_in_voice.en);
            }
            
            // Process the audio response
            const result = await processAudio(prompt, voiceChannel, interaction);
            
            if (result.success) {
                return interaction.editReply(answers.voice.success[lang] || answers.voice.success.en);
            } else {
                return interaction.editReply(result.error || (answers.voice.error[lang] || answers.voice.error.en));
            }
        } catch (error) {
            console.error('Error in voice command:', error);
            return interaction.editReply('An error occurred while processing your voice request. Please try again later.');
        }
    }
};
