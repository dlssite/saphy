const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const Server = require('../../models/Server');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-ai-favorites')
        .setDescription('Setup AI favorite music for this server')
        .setDefaultMemberPermissions(0x0000000000000008), // Administrator permission

    async execute(interaction, client) {
        try {
            const server = await Server.findById(interaction.guild.id) || new Server({ _id: interaction.guild.id });

            const modal = new ModalBuilder()
                .setCustomId('ai_favorites_modal')
                .setTitle('Setup AI Favorite Music');

            const favoritesInput = new TextInputBuilder()
                .setCustomId('favorites')
                .setLabel('Favorite Music')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Add favorite songs/playlists in format: name|url|type (song or playlist), one per line')
                .setValue(server.aiPersonality?.favorites?.map(f => `${f.name}|${f.url}|${f.type}`).join('\n') || '')
                .setRequired(false);

            const firstActionRow = new ActionRowBuilder().addComponents(favoritesInput);

            modal.addComponents(firstActionRow);

            await interaction.showModal(modal);

        } catch (error) {
            console.error('Setup AI Favorites command error:', error);
            const embed = new EmbedBuilder()
                .setDescription('❌ An error occurred while setting up AI favorite music!')
                .setColor('#FF0000');
            return interaction.editReply({ embeds: [embed] });
        }
    }
};
