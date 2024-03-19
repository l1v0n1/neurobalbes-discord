const { SlashCommandBuilder } = require('discord.js');
const { getChat } = require('../database');
const Markov = require('../markov.js');
const { choice, range, randomInteger, getLocaleWithoutString, getLocale } = require('../functions');
const { languages } = require('../assets/descriptions');
const { answers } = require('../assets/answers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gen')
    .setDescription(languages.gen.main['en-US'])
    .setDescriptionLocalizations(languages.gen.main)
    .addStringOption(option =>
      option
        .setName('type')
        .setDescription(languages.gen.type['en-US'])
        .setDescriptionLocalizations(languages.gen.type)
        .setRequired(true)
        .addChoices(
          { name: languages.gen.default['en-US'], value: 'default', name_localizations: languages.gen.default },
          { name: languages.gen.literate['en-US'], value: 'syntax', name_localizations: languages.gen.literate },
          { name: languages.gen.longtext['en-US'], value: 'long', name_localizations: languages.gen.longtext },
          { name: languages.gen.joke['en-US'], value: 'joke', name_localizations: languages.gen.joke },
          { name: languages.gen.buhurt['en-US'], value: 'bugurt', name_localizations: languages.gen.buhurt },
          { name: languages.gen.dialog['en-US'], value: 'dialogue', name_localizations: languages.gen.dialog },
          { name: languages.gen.verse['en-US'], value: 'poem', name_localizations: languages.gen.verse },
          { name: languages.gen.quote['en-US'], value: 'quote', name_localizations: languages.gen.quote }
        )
    ),
  async execute(interaction) {
    if (!interaction.guildId) return;

    await interaction.reply('⏳');
    const type = interaction.options.get('type').value;
    const chat = await getChat(interaction.guildId);
    const text_lines = chat.textbase.length;

    const chain = new Markov(chat.textbase.join(' '));

    if (text_lines < 1) {
      return await interaction.editReply(getLocaleWithoutString(answers, 'not_enough_data', chat.lang));
    }

    let reply;
    switch (type) {
      case 'default':
        reply = chain.generate_low();
        break;
      case 'syntax':
        reply = chain.generate_high();
        break;
      case 'long':
        reply = chain.generate_low(400);
        break;
      case 'joke': {
        const generated_text = chain.generate_low();
        const random_string = getLocale(answers, 'gen', 'jokes', chat.lang, generated_text);
        reply = choice(random_string);
        break;
      }
      case 'bugurt': {
        const bugurt = Array.from({ length: randomInteger(2, 8) }, () => chain.generate_low());
        reply = bugurt.join('\n@\n');
        break;
      }
      case 'dialogue': {
        const dialogue = Array.from({ length: randomInteger(3, 4) }, () => chain.generate_low());
        reply = dialogue.join('\n— ');
        break;
      }
      case 'poem': {
        const poem = [];
        const string = "`%VAR%`\n".replace('%VAR%', getLocale(answers, 'gen', 'poem', chat.lang));
        poem.push(string);
        for (const _ of range(1, randomInteger(4, 16))) {
          poem.push(chain.generate_high());
        }
        reply = poem.join('\n');
        break;
      }
      case 'quote':
        reply = `«${chain.generate_high(50)}», — *<@${interaction.applicationId}>*`;
        break;
      default:
        return;
    }

    await interaction.editReply(reply);
  }
};
