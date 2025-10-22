const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Server = require('../../models/Server');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('toggle-tts')
        .setDescription('Enable or disable TTS for this server')
        .setDefaultMemberPermissions(0x0000000000000008), // Administrator permission

    async execute(interaction, client) {
        try {
            const server = await Server.findById(interaction.guild.id) || new Server({ _id: interaction.guild.id });

            if (!server.ttsSettings?.apiKey) {
                const embed = new EmbedBuilder()
                    .setDescription('❌ TTS is not configured yet! Use `/setup-tts` to configure it first.')
                    .setColor('#FF0000');
                return await interaction.reply({ embeds: [embed], ephemeral: true });
            }

            // Toggle TTS enabled status
            const newStatus = !server.ttsSettings.enabled;
            server.ttsSettings.enabled = newStatus;
            await server.save();

            const embed = new EmbedBuilder()
                .setDescription(`✅ TTS has been ${newStatus ? 'enabled' : 'disabled'} for this server!`)
                .setColor(newStatus ? '#00FF00' : '#FFA500');
            await interaction.reply({ embeds: [embed], ephemeral: true });

        } catch (error) {
            console.error('Toggle TTS command error:', error);
            const embed = new EmbedBuilder()
                .setDescription('❌ An error occurred while toggling TTS!')
                .setColor('#FF0000');
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
};
