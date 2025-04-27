import { SlashCommandBuilder } from 'discord.js';
import { getChat } from '../src/database/database.js';
import { contains, choice, getLocale } from '../src/utils/functions.js';
import { languages } from '../assets/descriptions.js';
import { answers } from '../assets/answers.js';

export default {
	data: new SlashCommandBuilder()
		.setName('continue')
		.setDescription(languages.continue.main['en-US'])
        .setDescriptionLocalizations(languages.continue.main)
        .addStringOption(option => 
            option
            .setName("phrase")
            .setDescription(languages.continue.phrase['en-US'])
            .setDescriptionLocalizations(languages.continue.phrase)
            .setRequired(true)
            )
        .setDMPermission(false),
	async execute(interaction) {
        if (!interaction.guildId) {
             try { await interaction.reply({ content: "This command can only be used in a server.", flags: { ephemeral: true } }); } catch {}
             return;
        }

        let lang = 'en-US';
        try {
            const phrase = interaction.options.getString("phrase", true);
            let chat;
            try {
                chat = await getChat(interaction.guildId);
                lang = chat?.lang || 'en-US';
            } catch (dbError) {
                console.error(`DB error fetching chat for continue command in guild ${interaction.guildId}:`, dbError);
                 const dbErrorMessage = getLocale(answers, 'common', 'database_error', lang) || "Database error occurred.";
                return await interaction.editReply({ content: dbErrorMessage });
            }

            const textBase = chat?.textbase;
            if (!Array.isArray(textBase) || textBase.length === 0) {
                 const noDataMessage = getLocale(answers, 'gen', 'not_enough_data', lang) || "Not enough data to find continuations.";
                 return await interaction.editReply({ content: noDataMessage });
            }

            let elements = [];
            try {
                 elements = contains(textBase, phrase);
            } catch (containError) {
                 console.error(`Error during 'contains' function call for guild ${interaction.guildId}:`, containError);
                 const processError = getLocale(answers, 'common', 'processing_error', lang) || "Error processing request.";
                 return await interaction.editReply({ content: processError });
            }
           
            if (!Array.isArray(elements) || elements.length === 0) {
                 const notFoundMessage = getLocale(answers, 'continue', 'not_found', lang, phrase) || `No continuation found for "${phrase}".`;
                 return await interaction.editReply({ content: notFoundMessage });
            }
           
            try {
                const continuation = choice(elements);
                if (typeof continuation === 'string' && continuation.length > 0) {
                    await interaction.editReply(continuation);
                } else {
                    console.error(`'choice' function returned invalid result for guild ${interaction.guildId}:`, continuation);
                    const processError = getLocale(answers, 'common', 'processing_error', lang) || "Error selecting continuation.";
                    await interaction.editReply({ content: processError });
                }
            } catch (choiceError) {
                 console.error(`Error during 'choice' function call for guild ${interaction.guildId}:`, choiceError);
                 const processError = getLocale(answers, 'common', 'processing_error', lang) || "Error selecting continuation.";
                 await interaction.editReply({ content: processError });
            }

        } catch (error) {
            console.error(`Error executing continue command for guild ${interaction.guildId}:`, error);
            if (interaction.deferred || interaction.replied) {
                 try {
                     await interaction.editReply({ content: "An unexpected error occurred." });
                 } catch (editError) {
                     console.error("Failed to send final error reply for continue command:", editError);
                 }
             }
        }
	}
};