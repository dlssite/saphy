const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Server = require('../../models/Server');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('autoplay')
        .setDescription('Toggle autoplay mode')
        .addBooleanOption(option =>
            option.setName('enabled')
                .setDescription('Enable or disable autoplay')
                .setRequired(true)
        ),

    async execute(interaction, client) {
        await interaction.deferReply();

        const ConditionChecker = require('../../utils/checks');
        const checker = new ConditionChecker(client);
        
        try {
            const conditions = await checker.checkMusicConditions(
                interaction.guild.id, 
                interaction.user.id, 
                interaction.member.voice?.channelId
            );

            const canUse = await checker.canUseMusic(interaction.guild.id, interaction.user.id);
            if (!canUse) {
                const embed = new EmbedBuilder().setDescription('❌ You need DJ permissions to change autoplay settings!');
                return interaction.editReply({ embeds: [embed] })
                    .then(() => setTimeout(() => interaction.deleteReply().catch(() => {}), 3000));
            }

            const enabled = interaction.options.getBoolean('enabled');

            await Server.findByIdAndUpdate(interaction.guild.id, {
                'settings.autoplay': enabled
            }, { upsert: true });

            if (conditions.hasActivePlayer) {
                const player = conditions.player;
                player.isAutoplay = enabled;
            }

            const embed = new EmbedBuilder().setDescription(`🎲 Autoplay **${enabled ? 'enabled' : 'disabled'}**`);
            return interaction.editReply({ embeds: [embed] })
                .then(() => setTimeout(() => interaction.deleteReply().catch(() => {}), 3000));

        } catch (error) {
            console.error('Autoplay command error:', error);
            const embed = new EmbedBuilder().setDescription('❌ An error occurred while toggling autoplay!');
            return interaction.editReply({ embeds: [embed] })
                .then(() => setTimeout(() => interaction.deleteReply().catch(() => {}), 3000));
        }
    }
};
