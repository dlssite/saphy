const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'help',
    aliases: ['h'],
    description: 'List all available commands with interactive category selection',

    async execute(message, args, client) {
        try {
            // Load message commands
            const msgCommandsPath = path.join(__dirname, '..', 'message');
            const msgFiles = fs.readdirSync(msgCommandsPath).filter(file => file.endsWith('.js'));
            const messageCommands = msgFiles.map(file => {
                const cmd = require(path.join(msgCommandsPath, file));
                return {
                    name: cmd.name || 'Unknown',
                    description: cmd.description || 'No description',
                    aliases: cmd.aliases || []
                };
            });

            // Load slash commands
            const slashCommandsPath = path.join(__dirname, '..', 'slash');
            const slashFiles = fs.readdirSync(slashCommandsPath).filter(file => file.endsWith('.js'));
            const slashCommands = slashFiles.map(file => {
                const cmd = require(path.join(slashCommandsPath, file));
                return {
                    name: cmd.data?.name || 'Unknown',
                    description: cmd.data?.description || 'No description'
                };
            });

            // Categorize commands
            const categories = {
                '🎵 Music': {
                    message: messageCommands.filter(cmd =>
                        ['play', 'pause', 'resume', 'stop', 'skip', 'queue', 'nowplaying', 'shuffle', 'loop', 'volume', 'join', 'remove', 'jump', 'move', 'clear'].includes(cmd.name)
                    ),
                    slash: slashCommands.filter(cmd =>
                        ['play', 'pause', 'resume', 'stop', 'skip', 'queue', 'shuffle', 'loop', 'volume', 'join', 'remove', 'autoplay'].includes(cmd.name)
                    )
                },
                '🎤 TTS': {
                    message: [],
                    slash: slashCommands.filter(cmd =>
                        ['setup-tts', 'select-tts-voice', 'toggle-tts', 'tts-status'].includes(cmd.name)
                    )
                },
                '🤖 AI': {
                    message: [],
                    slash: slashCommands.filter(cmd =>
                        ['setup-ai', 'setup-ai-key', 'setup-ai-favorites'].includes(cmd.name)
                    )
                },
                '🏆 Leveling': {
                    message: [],
                    slash: slashCommands.filter(cmd =>
                        ['level', 'leaderboard', 'setup-leveling', 'setup-level-card', 'customize-level-card', 'setup-leveling-customization', 'setup-leveling-image', 'setup-leveling-color', 'setup-leveling-messages'].includes(cmd.name)
                    )
                },
                '⚙️ Utility': {
                    message: messageCommands.filter(cmd =>
                        ['ping', 'help', 'support'].includes(cmd.name)
                    ),
                    slash: slashCommands.filter(cmd =>
                        ['clean-up', 'clear', 'setup-central', 'disable-central'].includes(cmd.name)
                    )
                }
            };

            // Create dropdown menu
            const categoryOptions = Object.keys(categories).map(category => ({
                label: category,
                value: category,
                description: `${categories[category].message.length + categories[category].slash.length} commands`,
                emoji: category.split(' ')[0]
            }));

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('help_category_select')
                .setPlaceholder('Select a category to view commands')
                .addOptions(categoryOptions);

            const row = new ActionRowBuilder().addComponents(selectMenu);

            // Create initial embed
            const initialEmbed = new EmbedBuilder()
                .setTitle('📖 Saphyran - Help Center')
                .setColor(0x1DB954)
                .setDescription(
                    `**🌐 Bot Stats:** Serving in **${client.guilds.cache.size}** servers\n\n` +
                    `**📊 Total Commands:** ${messageCommands.length + slashCommands.length}\n` +
                    `**💬 Message Commands:** ${messageCommands.length}\n` +
                    `**⚡ Slash Commands:** ${slashCommands.length}\n\n` +
                    `**📂 Available Categories:**\n` +
                    Object.keys(categories).map(cat => `${cat} (${categories[cat].message.length + categories[cat].slash.length} commands)`).join('\n') + '\n\n' +
                    `Use the dropdown below to explore commands by category!`
                )
                .setFooter({ text: 'Saphyran • Developed by DLS' })
                .setTimestamp();

            await message.reply({ embeds: [initialEmbed], components: [row] });

        } catch (error) {
            console.error('Help command error:', error);
            await message.reply('❌ An error occurred while fetching commands.');
        }
    }
};
