const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Server = require('../../models/Server');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('view-ai-config')
        .setDescription('View current AI configuration for this server')
        .setDefaultMemberPermissions(0x0000000000000008), // Administrator permission

    async execute(interaction, client) {
        try {
            const server = await Server.findById(interaction.guild.id);

            if (!server) {
                const embed = new EmbedBuilder()
                    .setTitle('🤖 AI Configuration')
                    .setDescription('No AI configuration found for this server.')
                    .setColor('#FFA500');
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            const embed = new EmbedBuilder()
                .setTitle('🤖 AI Configuration')
                .setColor('#00FF00');

            // API Settings
            let apiSection = '❌ Not configured';
            if (server.aiSettings?.apiKey) {
                const maskedKey = server.aiSettings.apiKey.substring(0, 8) + '...' + server.aiSettings.apiKey.substring(server.aiSettings.apiKey.length - 4);
                apiSection = `✅ **API Key:** \`${maskedKey}\`\n**Model:** ${server.aiSettings.model || 'gemini-2.5-flash'}`;
            }
            embed.addFields({
                name: '🔑 API Settings',
                value: apiSection,
                inline: false
            });

            // Role Settings
            let roleSection = '❌ Not configured';
            if (server.patron_role_id || server.queen_role_id) {
                roleSection = '';
                if (server.patron_role_id) {
                    roleSection += `**Patron Role:** <@&${server.patron_role_id}>\n`;
                }
                if (server.queen_role_id) {
                    roleSection += `**Queen Role:** <@&${server.queen_role_id}>`;
                }
            }
            embed.addFields({
                name: '👑 Role Settings',
                value: roleSection,
                inline: false
            });

            // Personality Settings - split into multiple fields to avoid 1024 char limit
            const personalityFields = [];

            if (server.aiPersonality) {
                if (server.aiPersonality.bio) {
                    personalityFields.push({
                        name: '🎭 Bio',
                        value: server.aiPersonality.bio.length > 1024 ? server.aiPersonality.bio.substring(0, 1021) + '...' : server.aiPersonality.bio,
                        inline: false
                    });
                }
                if (server.aiPersonality.personality) {
                    personalityFields.push({
                        name: '🎭 Personality',
                        value: server.aiPersonality.personality.length > 1024 ? server.aiPersonality.personality.substring(0, 1021) + '...' : server.aiPersonality.personality,
                        inline: false
                    });
                }
                if (server.aiPersonality.customPrompt) {
                    personalityFields.push({
                        name: '🎭 Custom Prompt',
                        value: server.aiPersonality.customPrompt.length > 1024 ? server.aiPersonality.customPrompt.substring(0, 1021) + '...' : server.aiPersonality.customPrompt,
                        inline: false
                    });
                }
            }

            if (personalityFields.length === 0) {
                embed.addFields({
                    name: '🎭 Personality Settings',
                    value: '❌ Not configured',
                    inline: false
                });
            } else {
                embed.addFields(...personalityFields);
            }

            // Favorites (if any)
            if (server.aiPersonality?.favorites && server.aiPersonality.favorites.length > 0) {
                const favoritesList = server.aiPersonality.favorites
                    .map(f => `• ${f.name} (${f.type})`)
                    .join('\n');
                embed.addFields({
                    name: '🎵 Favorite Music',
                    value: favoritesList,
                    inline: false
                });
            }

            embed.setFooter({ text: 'Use /setup-ai-config to modify these settings' });

            await interaction.reply({ embeds: [embed], ephemeral: true });

        } catch (error) {
            console.error('View AI Config command error:', error);
            const embed = new EmbedBuilder()
                .setDescription('❌ An error occurred while viewing AI configuration!')
                .setColor('#FF0000');
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
};
