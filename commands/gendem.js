const { SlashCommandBuilder } = require('discord.js');
const { demotivatorImage } = require('../demotivator');
const { getChat } = require('../database');
const Markov  = require('../markov.js');
const { languages } = require('../assets/descriptions');
const { getLocaleWithoutString } = require('../functions');
const { answers } = require('../assets/answers');

const cooldown = new Set();
const cooldownTime = 15000; // 15 sec

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gendem')
    .setDescription(languages.gendem.main['en-US'])
    .setDescriptionLocalizations(languages.gendem.main)
    .addAttachmentOption((option) => option
      .setRequired(true)
      .setName('image')
      .setDescription(languages.gendem.image['en-US'])
      .setDescriptionLocalizations(languages.gendem.image)),
  async execute(interaction) {
    if (interaction.guildId != null) {
      await interaction.reply(`⏳`);
      const chat = await getChat(interaction.guildId);
      if (cooldown.has(interaction.user.id)) {
        await interaction.editReply({ 
            content: getLocaleWithoutString(answers, 'flood_control', chat.lang, cooldownTime / 1000),
            ephemeral: true 
        });
        return;
      }

      
      const attachment = interaction.options.getAttachment('image');
      if (!attachment.contentType.includes('image')) {
      return await interaction.editReply({
          content: getLocaleWithoutString(answers, 'not_image', chat.lang),
          ephemeral: true
      });
      }

      if (chat.textbase.length < 1) {
      return await interaction.editReply(getLocaleWithoutString(answers, 'not_enough_data', chat.lang));
      }

      cooldown.add(interaction.user.id);
      setTimeout(() => { cooldown.delete(interaction.user.id) }, cooldownTime);
      const chain = new Markov(chat.textbase.join(' '));
      const t1 = chain.generate_low(25);
      const t2 = chain.generate_low(30);
      const img = await demotivatorImage(attachment, t1, t2);
      return await interaction.editReply({ content: null, files: [img] });
    }
}
};
