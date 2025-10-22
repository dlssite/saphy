const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'support',
    description: 'Get support server and contact information',

    async execute(message) {
        try {
            const embed = new EmbedBuilder()
                .setTitle('💖 Support Saphyran')
                .setColor(0x1DB954)
                .addFields(
                    { name: '📋 Getting Help', value: 'Use `/help` or `!help` to view available commands and features.\nCheck command descriptions for usage details.' },
                    { name: '🐛 Report Issues', value: 'If you encounter bugs or errors, provide detailed information including:\n• Command used\n• Error message\n• Steps to reproduce' },
                    { name: '💡 Feature Requests', value: 'Have ideas for new features? Share them with specifics on how they would improve the bot.' },
                    { name: '👤 Contact Developer', value: 'For direct inquiries or support: **DLS**\nPlease be patient for responses.' },
                    { name: '💰 Support the Bot', value: 'Help keep Saphyran running and growing! Your donations are greatly appreciated.\n[Ko-fi](https://ko-fi.com/sanctyr)' },
                    { name: '🔗 Community Links', value: '[Website](https://sanctyr.space)\n[Discord Server](https://discord.gg/sanctyr)' }
                )
                .setDescription('Support Saphyran by reporting issues, suggesting features, or contributing financially. Your help keeps the bot alive and improving!')
                .setTimestamp()
                .setFooter({ text: 'Saphyran • Developed by DLS' });

            await message.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Support command error:', error);
            await message.reply('❌ An error occurred while fetching support information.');
        }
    }
};
