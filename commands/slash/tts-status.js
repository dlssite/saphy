const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Server = require('../../models/Server');
const TTSManager = require('../../utils/tts');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tts-status')
        .setDescription('View current TTS settings and status for this server'),

    async execute(interaction, client) {
        try {
            const server = await Server.findById(interaction.guild.id) || new Server({ _id: interaction.guild.id });
            const ttsManager = new TTSManager(client);

            const embed = new EmbedBuilder()
                .setTitle('🎤 TTS Status')
                .setColor('#0099FF');

            if (!server.ttsSettings?.apiKey) {
                embed.setDescription('❌ TTS is not configured for this server.\n\nUse `/setup-tts` to configure TTS settings.');
            } else {
                const enabled = server.ttsSettings.enabled ? '✅ Enabled' : '❌ Disabled';
                const model = server.ttsSettings.model || 'Not set';
                const voice = server.ttsSettings.voice || 'Not set';
                const availableVoices = ttsManager.getAvailableVoices().join(', ');

                embed.setDescription(`**Status:** ${enabled}\n**Model:** ${model}\n**Voice:** ${voice}\n\n**Available Voices:** ${availableVoices}`);
            }

            await interaction.reply({ embeds: [embed], ephemeral: true });

        } catch (error) {
            console.error('TTS Status command error:', error);
            const embed = new EmbedBuilder()
                .setDescription('❌ An error occurred while retrieving TTS status!')
                .setColor('#FF0000');
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
};
