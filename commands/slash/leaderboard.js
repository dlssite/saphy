const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getLeaderboard } = require('../../utils/voiceLeveling');

const ITEMS_PER_PAGE = 10;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Displays the voice activity leaderboard.'),

    async execute(interaction, client) {
        await interaction.deferReply();

        try {
            const leaderboard = await getLeaderboard(interaction.guild.id);

            if (!leaderboard || leaderboard.length === 0) {
                return interaction.editReply({ content: '📊 The leaderboard is currently empty!' });
            }

            const totalPages = Math.ceil(leaderboard.length / ITEMS_PER_PAGE);
            const page = 0;

            const embed = await generateLeaderboardEmbed(interaction, leaderboard, page, totalPages);
            const components = buildPaginationComponents(page, totalPages);

            const message = await interaction.editReply({ embeds: [embed], components });

            // Cache the data for pagination
            if (!global.leaderboardCache) global.leaderboardCache = new Map();
            global.leaderboardCache.set(message.id, { leaderboard, page, totalPages, userId: interaction.user.id });

        } catch (error) {
            console.error('Error fetching leaderboard:', error);
            return interaction.editReply({ content: '❌ An error occurred while fetching the leaderboard.' });
        }
    },
};

async function generateLeaderboardEmbed(interaction, leaderboard, page, totalPages) {
    const start = page * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const pageData = leaderboard.slice(start, end);

    // Get server customizations
    const server = await require('../../models/Server').findById(interaction.guild.id) || {};
    const serverCard = server.levelCard || {};

    const embedColor = serverCard.accentColor || '#ffeb3b';
    const rankEmojis = ['🥇', '🥈', '🥉'];

    let description = `**Page ${page + 1} of ${totalPages}**\n\n`;

    for (let i = 0; i < pageData.length; i++) {
        const user = pageData[i];
        const globalRank = start + i + 1;
        const rankText = globalRank <= 3 ? rankEmojis[globalRank - 1] : `${globalRank}.`;

        try {
            const member = await interaction.guild.members.fetch(user.discordId);
            description += `${rankText} ${member.user.username} - Level ${user.level} • ${user.xp.toLocaleString()} XP\n`;
        } catch (error) {
            console.error(`Could not fetch member for user ID ${user.discordId}:`, error);
            description += `${rankText} Unknown User - Level ${user.level} • ${user.xp.toLocaleString()} XP\n`;
        }
    }

    const embed = new EmbedBuilder()
        .setTitle('🏆 Voice Activity Leaderboard')
        .setDescription(description)
        .setColor(embedColor)
        .setTimestamp()
        .setFooter({ text: `Total Users: ${leaderboard.length}` });

    return embed;
}

function buildPaginationComponents(page, totalPages) {
    const row = new ActionRowBuilder();

    const prevButton = new ButtonBuilder()
        .setCustomId('leaderboard_prev')
        .setLabel('Previous')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('⬅️')
        .setDisabled(page === 0);

    const nextButton = new ButtonBuilder()
        .setCustomId('leaderboard_next')
        .setLabel('Next')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('➡️')
        .setDisabled(page === totalPages - 1);

    row.addComponents(prevButton, nextButton);

    return totalPages > 1 ? [row] : [];
}
