    const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const Server = require('../../models/Server');
const TTSManager = require('../../utils/tts');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-tts')
        .setDescription('Setup TTS API key, model, and voice for this server')
        .setDefaultMemberPermissions(0x0000000000000008), // Administrator permission

    async execute(interaction, client) {
        try {
            const server = await Server.findById(interaction.guild.id) || new Server({ _id: interaction.guild.id });
            const ttsManager = new TTSManager(client);

            const modal = new ModalBuilder()
                .setCustomId('tts_setup_modal')
                .setTitle('Setup TTS Settings');

            const apiKeyInput = new TextInputBuilder()
                .setCustomId('tts_api_key')
                .setLabel('Google Cloud API Key (get from https://console.cloud.google.com/apis/credentials)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Enter your Google Cloud API key')
                .setValue(server.ttsSettings?.apiKey || '')
                .setRequired(true);

            const modelInput = new TextInputBuilder()
                .setCustomId('tts_model')
                .setLabel('TTS Model')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Google TTS uses voices directly (leave as default)')
                .setValue(server.ttsSettings?.model || 'google-tts')
                .setRequired(true);

            const voiceInput = new TextInputBuilder()
                .setCustomId('tts_voice')
                .setLabel('Voice')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder(`Available: ${ttsManager.getAvailableVoices().join(', ')}`)
                .setValue(server.ttsSettings?.voice || 'en-US-Neural2-A')
                .setRequired(true);

            const firstActionRow = new ActionRowBuilder().addComponents(apiKeyInput);
            const secondActionRow = new ActionRowBuilder().addComponents(modelInput);
            const thirdActionRow = new ActionRowBuilder().addComponents(voiceInput);

            modal.addComponents(firstActionRow, secondActionRow, thirdActionRow);

            await interaction.showModal(modal);

        } catch (error) {
            console.error('Setup TTS command error:', error);
            const embed = new EmbedBuilder()
                .setDescription('❌ An error occurred while setting up TTS!')
                .setColor('#FF0000');
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
};
