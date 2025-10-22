const { SlashCommandBuilder, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const Server = require('../../models/Server');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-lavalink')
        .setDescription('Configure Lavalink server settings for this server')
        .setDefaultMemberPermissions(0), // Admin only

    async execute(interaction, client) {
        try {
            const server = await Server.findById(interaction.guild.id) || new Server({ _id: interaction.guild.id });

            // Create modal for Lavalink configuration
            const modal = new ModalBuilder()
                .setCustomId('lavalink_setup_modal')
                .setTitle('Lavalink Server Configuration');

            const hostInput = new TextInputBuilder()
                .setCustomId('lavalink_host')
                .setLabel('Lavalink Host')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('lava-v4.ajieblogs.eu.org')
                .setValue(server.lavalinkSettings?.host || '')
                .setRequired(true);

            const portInput = new TextInputBuilder()
                .setCustomId('lavalink_port')
                .setLabel('Lavalink Port')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('443')
                .setValue(server.lavalinkSettings?.port?.toString() || '')
                .setRequired(true);

            const passwordInput = new TextInputBuilder()
                .setCustomId('lavalink_password')
                .setLabel('Lavalink Password')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Enter your Lavalink password')
                .setValue(server.lavalinkSettings?.password || '')
                .setRequired(true);

            const secureInput = new TextInputBuilder()
                .setCustomId('lavalink_secure')
                .setLabel('Secure Connection (true/false)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('true')
                .setValue(server.lavalinkSettings?.secure?.toString() || 'true')
                .setRequired(true);

            const firstActionRow = new ActionRowBuilder().addComponents(hostInput);
            const secondActionRow = new ActionRowBuilder().addComponents(portInput);
            const thirdActionRow = new ActionRowBuilder().addComponents(passwordInput);
            const fourthActionRow = new ActionRowBuilder().addComponents(secureInput);

            modal.addComponents(firstActionRow, secondActionRow, thirdActionRow, fourthActionRow);

            await interaction.showModal(modal);

        } catch (error) {
            console.error('Error showing Lavalink setup modal:', error);
            const embed = new EmbedBuilder()
                .setDescription('❌ An error occurred while opening the Lavalink setup modal!')
                .setColor('#FF0000');
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
};
