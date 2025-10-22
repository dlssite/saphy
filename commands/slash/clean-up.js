const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const GarbageCollector = require('../../utils/garbageCollector');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clean-up')
        .setDescription('Force garbage collection (owner only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, client) {

        if (!config.bot.ownerIds.includes(interaction.user.id)) {
            return interaction.reply({
                content: '❌ Only bot owners can use this command!',
                ephemeral: true
            });
        }

        const before = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
        GarbageCollector.forceCleanup();
        const after = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);

        await interaction.reply({
            content: `🗑️ Cleanup completed!\nMemory: ${before}MB → ${after}MB`,
            ephemeral: true
        });
    }
};
