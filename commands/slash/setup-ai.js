const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const Server = require('../../models/Server');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-ai')
        .setDescription('Setup AI personality for this server')
        .setDefaultMemberPermissions(0x0000000000000008), // Administrator permission

    async execute(interaction, client) {
        try {
            const server = await Server.findById(interaction.guild.id) || new Server({ _id: interaction.guild.id });

            const modal = new ModalBuilder()
                .setCustomId('ai_personality_modal')
                .setTitle('Setup AI Personality');

            const bioInput = new TextInputBuilder()
                .setCustomId('bio')
                .setLabel('Bio')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Describe the AI character\'s background...')
                .setValue(server.aiPersonality?.bio || '')
                .setRequired(false);

            const personalityInput = new TextInputBuilder()
                .setCustomId('personality')
                .setLabel('Personality')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Describe the AI character\'s personality traits...')
                .setValue(server.aiPersonality?.personality || '')
                .setRequired(false);

            const hierarchyInput = new TextInputBuilder()
                .setCustomId('hierarchy')
                .setLabel('Server Hierarchy')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Describe the server hierarchy and roles...')
                .setValue(server.aiPersonality?.serverHierarchy || '')
                .setRequired(false);

            const loreInput = new TextInputBuilder()
                .setCustomId('lore')
                .setLabel('Server Lore')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Describe the server\'s lore and history...')
                .setValue(server.aiPersonality?.serverLore || '')
                .setRequired(false);

            const customPromptInput = new TextInputBuilder()
                .setCustomId('custom_prompt')
                .setLabel('Custom Prompt (Optional)')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Additional custom instructions for the AI...')
                .setValue(server.aiPersonality?.customPrompt || '')
                .setRequired(false);

            const firstActionRow = new ActionRowBuilder().addComponents(bioInput);
            const secondActionRow = new ActionRowBuilder().addComponents(personalityInput);
            const thirdActionRow = new ActionRowBuilder().addComponents(hierarchyInput);
            const fourthActionRow = new ActionRowBuilder().addComponents(loreInput);
            const fifthActionRow = new ActionRowBuilder().addComponents(customPromptInput);

            modal.addComponents(firstActionRow, secondActionRow, thirdActionRow, fourthActionRow, fifthActionRow);

            await interaction.showModal(modal);

        } catch (error) {
            console.error('Setup AI command error:', error);
            const embed = new EmbedBuilder()
                .setDescription('❌ An error occurred while setting up AI personality!')
                .setColor('#FF0000');
            return interaction.editReply({ embeds: [embed] });
        }
    }
};
