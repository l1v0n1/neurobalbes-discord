const fs = require('fs/promises');
const { SlashCommandBuilder } = require('@discordjs/builders');
const { languages } = require('../assets/descriptions');
const { getChat } = require('../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription(languages.help.main['en-US'])
    .setDescriptionLocalizations(languages.help.main),

  async execute(interaction) {
    await interaction.reply('⏳');
    const chat = await getChat(interaction.guildId);
    const lang = chat.lang === 'en' ? 'en-US' : chat.lang;

    try {
      const commandFiles = await fs.readdir('./commands');
      const commands = commandFiles.filter((file) => file.endsWith('.js'));

      let str = '';

      for (const file of commands) {
        const command = require(`./${file}`);
        const name = command.data.name;
        const description = command.data.description_localizations[lang];
        str += `**/${name}** - *${description}*\n`;
      }

      return interaction.editReply({
        content: str,
        ephemeral: true,
      });
    } catch (error) {
      console.error(error);
      return interaction.editReply({
        content: 'An error occurred while retrieving the commands.',
        ephemeral: true,
      });
    }
  },
};
