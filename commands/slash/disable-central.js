const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const Server = require('../../models/Server');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('disable-central')
        .setDescription('Disable the central music system')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });

        const guildId = interaction.guild.id;

        try {
            const serverConfig = await Server.findById(guildId);
            
            if (!serverConfig?.centralSetup?.enabled) {
                return interaction.editReply({
                    content: '❌ Central music system is not currently setup!',
                    ephemeral: true
                });
            }

            try {
                const channel = await client.channels.fetch(serverConfig.centralSetup.channelId);
                const message = await channel.messages.fetch(serverConfig.centralSetup.embedId);
                await message.delete();
            } catch (error) {
                console.log('Central embed already deleted or inaccessible');
            }

            await Server.findByIdAndUpdate(guildId, {
                'centralSetup.enabled': false,
                'centralSetup.channelId': null,
                'centralSetup.embedId': null
            });

            const embed = new EmbedBuilder()
                .setTitle('✅ Central Music System Disabled')
                .setDescription('The central music system has been disabled and embed removed.')
                .setColor(0xFF6B6B)
                .setFooter({ text: 'You can re-enable it anytime with /setup-central' });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error disabling central system:', error);
            
            await interaction.editReply({
                content: '❌ An error occurred while disabling the central music system!',
                ephemeral: true
            });
        }
    }
};
