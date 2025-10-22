const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const Server = require('../../models/Server');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('customize-level-card')
        .setDescription('Customize your personal level card appearance'),
    async execute(interaction) {
        const server = await Server.findById(interaction.guild.id) || new Server({ _id: interaction.guild.id });

        // Check if user has permission to customize
        const allowedRoles = server.levelCard?.allowedRoles || [];
        const hasPermission = interaction.member.permissions.has('Administrator') ||
                            allowedRoles.some(roleId => interaction.member.roles.cache.has(roleId));

        if (!hasPermission) {
            return interaction.reply({
                content: '❌ You need administrator permissions or a role allowed to customize level cards.',
                ephemeral: true
            });
        }

        // Get user's personal customization
        const userCustomization = server.userLevelCards?.[interaction.user.id] || {};

        const embed = new EmbedBuilder()
            .setTitle('🎨 Personal Level Card Customization')
            .setDescription('Customize how your level card looks!')
            .setColor('#0099ff')
            .addFields(
                { name: 'Your Current Settings', value: `
**Background Color:** ${userCustomization.backgroundColor || 'Server Default'}
**Accent Color:** ${userCustomization.accentColor || 'Server Default'}
**Text Color:** ${userCustomization.textColor || 'Server Default'}
**Progress Bar Color:** ${userCustomization.progressColor || 'Server Default'}
**Custom Background Image:** ${userCustomization.backgroundImage ? 'Set' : 'Not set'}
                `, inline: false }
            );

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('personal_level_card_colors')
                    .setLabel('🎨 Set Colors')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('personal_level_card_image')
                    .setLabel('🖼️ Set Background Image')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('personal_level_card_reset')
                    .setLabel('🔄 Reset to Server Default')
                    .setStyle(ButtonStyle.Danger)
            );

        await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    },
};
