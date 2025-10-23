const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const Server = require('../../models/Server');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-leveling-rates')
        .setDescription('Set the XP rates for leveling in this server.')
        .addIntegerOption(option =>
            option.setName('xp_per_minute')
                .setDescription('XP awarded per minute in voice channels (default: 1)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100)
        )
        .addIntegerOption(option =>
            option.setName('xp_per_level')
                .setDescription('XP required per level (default: 100)')
                .setRequired(true)
                .setMinValue(10)
                .setMaxValue(1000)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const xpPerMinute = interaction.options.getInteger('xp_per_minute');
        const xpPerLevel = interaction.options.getInteger('xp_per_level');
        const guildId = interaction.guild.id;

        try {
            const server = await Server.findOneAndUpdate(
                { _id: guildId },
                {
                    'settings.levelingXPPerMinute': xpPerMinute,
                    'settings.levelingXPPerLevel': xpPerLevel
                },
                { upsert: true, new: true }
            );

            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setDescription(`✅ Leveling rates updated!\n\n**XP per minute:** ${xpPerMinute}\n**XP per level:** ${xpPerLevel}`)
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error setting leveling rates:', error);
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setDescription('❌ There was an error setting the leveling rates.');

            await interaction.editReply({ embeds: [embed] });
        }
    },
};
