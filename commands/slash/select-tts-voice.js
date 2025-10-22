const { SlashCommandBuilder, EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
const Server = require('../../models/Server');
const TTSManager = require('../../utils/tts');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('select-tts-voice')
        .setDescription('Select a voice for TTS in this server')
        .setDefaultMemberPermissions(0x0000000000000008), // Administrator permission

    async execute(interaction, client) {
        try {
            const server = await Server.findById(interaction.guild.id) || new Server({ _id: interaction.guild.id });
            const ttsManager = new TTSManager(client);

            if (!server.ttsSettings?.apiKey) {
                const embed = new EmbedBuilder()
                    .setDescription('❌ TTS is not configured yet! Use `/setup-tts` to configure it first.')
                    .setColor('#FF0000');
                return await interaction.reply({ embeds: [embed], ephemeral: true });
            }

            const voices = ttsManager.getAvailableVoices();
            const currentVoice = server.ttsSettings.voice || 'en-US-Neural2-A';

            const embed = new EmbedBuilder()
                .setTitle('🎤 Select TTS Voice')
                .setDescription('Choose a voice for the TTS system. The current voice is highlighted.')
                .setColor('#0099FF');

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('tts_voice_select')
                .setPlaceholder('Select a voice...');

            voices.forEach(voice => {
                selectMenu.addOptions({
                    label: voice.charAt(0).toUpperCase() + voice.slice(1),
                    value: voice,
                    description: `Voice: ${voice}`,
                    default: voice === currentVoice
                });
            });

            const row = new ActionRowBuilder().addComponents(selectMenu);

            await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });

        } catch (error) {
            console.error('Select TTS Voice command error:', error);
            const embed = new EmbedBuilder()
                .setDescription('❌ An error occurred while selecting TTS voice!')
                .setColor('#FF0000');
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
};
