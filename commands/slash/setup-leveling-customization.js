const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const Server = require('../../models/Server');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-leveling-customization')
        .setDescription('Customize level up notifications with image, color, and messages.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const modal = new ModalBuilder()
            .setCustomId('leveling_customization_modal')
            .setTitle('Level Up Customization');

        const imageInput = new TextInputBuilder()
            .setCustomId('image_url')
            .setLabel('Notification Image URL')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('https://example.com/image.png')
            .setRequired(false);

        const colorInput = new TextInputBuilder()
            .setCustomId('embed_color')
            .setLabel('Embed Color (Hex)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('#00ff00')
            .setRequired(false);

        const messagesInput = new TextInputBuilder()
            .setCustomId('leveling_messages')
            .setLabel('Level Up Messages (separate with |)')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Message 1|Message 2|Message 3\nUse {user} and {level} as placeholders')
            .setRequired(false);

        const firstActionRow = new ActionRowBuilder().addComponents(imageInput);
        const secondActionRow = new ActionRowBuilder().addComponents(colorInput);
        const thirdActionRow = new ActionRowBuilder().addComponents(messagesInput);

        modal.addComponents(firstActionRow, secondActionRow, thirdActionRow);

        await interaction.showModal(modal);
    },
};
