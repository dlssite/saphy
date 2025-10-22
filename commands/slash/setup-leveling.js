const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const Server = require('../../models/Server'); // Assuming you have a Server model for guild settings

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-leveling')
        .setDescription('Set up the channel for level up notifications.')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel to send level up notifications to.')
                .setRequired(true)

        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator), // Only administrators can use this command

    async execute(interaction) {
        const channel = interaction.options.getChannel('channel');
        const guildId = interaction.guild.id;

        try {
            // Find or create the server document
            const server = await Server.findOneAndUpdate(
                { _id: guildId },
                { levelingChannelId: channel.id },
                { upsert: true, new: true }
            );

            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setDescription(`✅ Level up notifications will now be sent to ${channel}.`);

            await interaction.reply({ embeds: [embed], ephemeral: true });

        } catch (error) {
            console.error('Error setting up leveling channel:', error);
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setDescription('❌ There was an error setting up the leveling channel.');

            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    },
};