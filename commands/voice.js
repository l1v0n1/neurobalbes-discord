import { SlashCommandBuilder } from 'discord.js';
import { answers } from '../assets/answers.js';
import { processAudio } from '../src/tts/audioProcessor.js';
import { getServerLanguage, getLocalizedString } from '../src/utils/language.js';

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
            const lang = await getServerLanguage(guildId);
            const prompt = interaction.options.getString('prompt');
            
            if (!prompt) {
                const response = await getLocalizedString(answers, 'voice', 'no_prompt', lang);
                return interaction.editReply(response);
            }
            
            // Check if user is in a voice channel
            const voiceChannel = interaction.member?.voice.channel;
            if (!voiceChannel) {
                const response = await getLocalizedString(answers, 'voice', 'not_in_voice', lang);
                return interaction.editReply(response);
            }
            
            // Process the audio response
            const result = await processAudio(prompt, voiceChannel, interaction);
            
            if (result.success) {
                const response = await getLocalizedString(answers, 'voice', 'success', lang);
                return interaction.editReply(response);
            } else {
                const errorResponse = await getLocalizedString(answers, 'voice', 'error', lang);
                return interaction.editReply(result.error || errorResponse);
            }
        } catch (error) {
            console.error('Error in voice command:', error);
            return interaction.editReply('An error occurred while processing your voice request. Please try again later.');
        }
    }
};
