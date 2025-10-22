const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const Server = require('../../models/Server');
const axios = require('axios');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-ai-key')
        .setDescription('Setup AI API key and model for this server')
        .setDefaultMemberPermissions(0x0000000000000008), // Administrator permission

    async execute(interaction, client) {
        try {
            const server = await Server.findById(interaction.guild.id) || new Server({ _id: interaction.guild.id });

            const modal = new ModalBuilder()
                .setCustomId('ai_key_modal')
                .setTitle('Setup AI API Key & Model');

            const apiKeyInput = new TextInputBuilder()
                .setCustomId('api_key')
                .setLabel('OpenRouter API Key')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Enter your OpenRouter API key...')
                .setValue(server.aiSettings?.apiKey || '')
                .setRequired(true);

            const modelInput = new TextInputBuilder()
                .setCustomId('model')
                .setLabel('AI Model')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('e.g., openai/gpt-3.5-turbo, anthropic/claude-3-haiku:beta')
                .setValue(server.aiSettings?.model || 'openai/gpt-3.5-turbo')
                .setRequired(true);

            const firstActionRow = new ActionRowBuilder().addComponents(apiKeyInput);
            const secondActionRow = new ActionRowBuilder().addComponents(modelInput);

            modal.addComponents(firstActionRow, secondActionRow);

            await interaction.showModal(modal);

        } catch (error) {
            console.error('Setup AI Key command error:', error);
            const embed = new EmbedBuilder()
                .setDescription('❌ An error occurred while setting up AI key!')
                .setColor('#FF0000');
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
};
