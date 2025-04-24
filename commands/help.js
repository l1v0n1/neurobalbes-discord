const fs = require('fs/promises');
const path = require('path');
const { SlashCommandBuilder, Util } = require('discord.js');
const { languages } = require('../assets/descriptions');
const { getChat } = require('../database');
const { getLocale } = require('../functions');
const { answers } = require('../assets/answers');

const MAX_REPLY_LENGTH = 2000;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription(languages.help.main['en-US'])
    .setDescriptionLocalizations(languages.help.main),

  async execute(interaction) {
    if (!interaction.guildId) {
      try {
        await interaction.reply({ content: 'Help command currently requires server context.', ephemeral: true });
      } catch (replyError) { console.error('Failed to send guild-only reply:', replyError); }
      return;
    }

    try {
      await interaction.deferReply({ ephemeral: true });

      let lang = 'en-US';
      try {
        const chat = await getChat(interaction.guildId);
        lang = chat?.lang === 'en' ? 'en-US' : (chat?.lang || 'en-US');
      } catch (dbError) {
        console.warn(`Help command: Failed to get chat/lang for guild ${interaction.guildId}. Falling back to en-US. Error: ${dbError}`);
      }

      const commandsDir = path.join(__dirname);
      const commandFiles = await fs.readdir(commandsDir);
      const jsFiles = commandFiles.filter((file) => file.endsWith('.js') && file !== path.basename(__filename));

      let commandList = [];

      for (const file of jsFiles) {
        try {
          const command = require(path.join(commandsDir, file));

          if (command.data instanceof SlashCommandBuilder) {
            const name = command.data.name;
            const description = command.data.description_localizations?.[lang] ?? command.data.description;
            if (name && description) {
              commandList.push(`**/${name}** - *${description}*`);
            }
          } else {
            console.warn(`File ${file} in commands directory does not export a SlashCommandBuilder in data.`);
          }
        } catch (loadError) {
          console.error(`Help command: Failed to load or process command file ${file}:`, loadError);
        }
      }

      if (commandList.length === 0) {
        return interaction.editReply({
          content: getLocale(answers, 'help', 'no_commands', lang),
          ephemeral: true,
        });
      }

      const helpText = commandList.join('\n');

      const messages = Util.splitMessage(helpText, { maxLength: MAX_REPLY_LENGTH, char: '\n' });

      await interaction.editReply({
        content: messages[0],
        ephemeral: true,
      });

      for (let i = 1; i < messages.length; i++) {
        await interaction.followUp({
          content: messages[i],
          ephemeral: true,
        });
      }
    } catch (error) {
      console.error('Error executing help command:', error);
      if (!interaction.replied && !interaction.deferred) {
        try { await interaction.reply({ content: 'An error occurred while retrieving commands.', ephemeral: true }); } catch {}
      } else {
        try { await interaction.editReply({ content: 'An error occurred while retrieving commands.' }); } catch {}
      }
    }
  },
};
