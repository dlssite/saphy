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
                const embed = new EmbedBuilder()
                    .setColor('#FFFF00')
                    .setDescription('📊 The leaderboard is currently empty!');
                return interaction.editReply({ embeds: [embed] });
            }

            const totalPages = Math.ceil(leaderboard.length / ITEMS_PER_PAGE);
            const page = 0;

            const embed = await buildLeaderboardEmbed(interaction, leaderboard, page, totalPages);
            const components = buildPaginationComponents(page, totalPages);

            const message = await interaction.editReply({ embeds: [embed], components });

            // Cache the data for pagination
            if (!global.leaderboardCache) global.leaderboardCache = new Map();
            global.leaderboardCache.set(message.id, { leaderboard, page, totalPages, userId: interaction.user.id });

        } catch (error) {
            console.error('Error fetching leaderboard:', error);
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setDescription('❌ An error occurred while fetching the leaderboard.');
            return interaction.editReply({ embeds: [embed] });
        }
    },
};

async function buildLeaderboardEmbed(interaction, leaderboard, page, totalPages) {
    const start = page * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const pageData = leaderboard.slice(start, end);

    const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🏆 Voice Activity Leaderboard')
        .setDescription('Top members by voice activity levels and XP!')
        .setThumbnail(interaction.guild.iconURL({ dynamic: true, size: 128 }) || null)
        .setTimestamp()
        .setFooter({
            text: `Page ${page + 1} of ${totalPages} | Requested by ${interaction.user.username}`,
            iconURL: interaction.user.displayAvatarURL({ dynamic: true, size: 32 })
        });

    const rankEmojis = ['🥇', '🥈', '🥉'];

    for (let i = 0; i < pageData.length; i++) {
        const user = pageData[i];
        const globalRank = start + i + 1;
        const emoji = globalRank <= 3 ? rankEmojis[globalRank - 1] : `**${globalRank}.**`;

        try {
            const member = await interaction.guild.members.fetch(user.discordId);
            const username = member.user.username;
            const displayName = member.displayName !== username ? `${member.displayName} (${username})` : username;

            embed.addFields({
                name: `${emoji} ${displayName}`,
                value: `**Level:** ${user.level} | **XP:** ${user.xp.toLocaleString()}`,
                inline: false
            });
        } catch (error) {
            console.error(`Could not fetch member for user ID ${user.discordId}:`, error);
            embed.addFields({
                name: `${emoji} Unknown User`,
                value: `**Level:** ${user.level} | **XP:** ${user.xp.toLocaleString()}`,
                inline: false
            });
        }
    }

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
