const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const Server = require('../../models/Server');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-level-card')
        .setDescription('Customize the level card appearance for the server (Admin only)')
        .setDefaultMemberPermissions(0x0000000000000008), // Administrator permission
    async execute(interaction) {
        const server = await Server.findById(interaction.guild.id) || new Server({ _id: interaction.guild.id });

        const embed = new EmbedBuilder()
            .setTitle('🎨 Level Card Customization')
            .setDescription('Customize how level cards look for your server!')
            .setColor('#0099ff')
            .addFields(
                { name: 'Current Settings', value: `
**Background Color:** ${server.levelCard?.backgroundColor || 'Default (Dark Blue)'}
**Accent Color:** ${server.levelCard?.accentColor || 'Default (Gold)'}
**Text Color:** ${server.levelCard?.textColor || 'Default (White)'}
**Progress Bar Color:** ${server.levelCard?.progressColor || 'Default (Green)'}
**Custom Background Image:** ${server.levelCard?.backgroundImage ? 'Set' : 'Not set'}
**Allowed Roles:** ${server.levelCard?.allowedRoles?.length ? server.levelCard.allowedRoles.length + ' roles' : 'None (Admin only)'}
                `, inline: false }
            );

        const row1 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('level_card_colors')
                    .setLabel('🎨 Set Colors')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('level_card_image')
                    .setLabel('🖼️ Set Background Image')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('level_card_roles')
                    .setLabel('👥 Set Allowed Roles')
                    .setStyle(ButtonStyle.Secondary)
            );

        const row2 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('level_card_reset')
                    .setLabel('🔄 Reset to Default')
                    .setStyle(ButtonStyle.Danger)
            );

        await interaction.reply({ embeds: [embed], components: [row1, row2], ephemeral: true });
    },
};
