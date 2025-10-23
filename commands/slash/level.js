const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { getUserLevelAndXP } = require('../../utils/voiceLeveling');
const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');

// Helper function to draw gradient background
function drawGradientBackground(ctx, userCard, serverCard) {
    const gradient = ctx.createLinearGradient(0, 0, 800, 300);
    const bgColor = userCard.backgroundColor || serverCard.backgroundColor;
    if (bgColor) {
        gradient.addColorStop(0, bgColor);
        gradient.addColorStop(1, adjustColor(bgColor, -20));
    } else {
        gradient.addColorStop(0, '#1a1a2e');
        gradient.addColorStop(0.5, '#16213e');
        gradient.addColorStop(1, '#0f3460');
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 800, 300);
}

// Helper function to adjust color brightness
function adjustColor(color, amount) {
    const usePound = color[0] === '#';
    const col = usePound ? color.slice(1) : color;

    const num = parseInt(col, 16);
    let r = (num >> 16) + amount;
    let g = (num >> 8 & 0x00FF) + amount;
    let b = (num & 0x0000FF) + amount;

    r = r > 255 ? 255 : r < 0 ? 0 : r;
    g = g > 255 ? 255 : g < 0 ? 0 : g;
    b = b > 255 ? 255 : b < 0 ? 0 : b;

    return (usePound ? '#' : '') + (r << 16 | g << 8 | b).toString(16);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('level')
        .setDescription('Checks your current voice activity level with a beautiful card.'),
    async execute(interaction) {
        await interaction.deferReply();

        const userId = interaction.user.id;
        const guildId = interaction.guild.id;

        try {
            const userData = await getUserLevelAndXP(userId, guildId);

            if (!userData) {
                return interaction.editReply({ content: 'You haven\'t gained any voice activity yet!' });
            }

            // Get server and user customizations
            const server = await require('../../models/Server').findById(guildId) || {};
            const serverCard = server.levelCard || {};
            const userCard = server.userLevelCards?.[userId] || {};

            // Create the level card image
            const canvas = createCanvas(800, 300);
            const ctx = canvas.getContext('2d');

            // Background - use custom image if available, otherwise gradient
            if (userCard.backgroundImage || serverCard.backgroundImage) {
                try {
                    const bgImageUrl = userCard.backgroundImage || serverCard.backgroundImage;
                    const bgImage = await loadImage(bgImageUrl);
                    ctx.drawImage(bgImage, 0, 0, 800, 300);
                } catch (error) {
                    console.log('Failed to load background image, using gradient');
                    drawGradientBackground(ctx, userCard, serverCard);
                }
            } else {
                drawGradientBackground(ctx, userCard, serverCard);
            }

            // Add some decorative elements
            ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.fillRect(0, 0, 800, 300);

            // Border with rounded corners effect
            ctx.strokeStyle = userCard.textColor || serverCard.textColor || '#ffffff';
            ctx.lineWidth = 6;
            ctx.strokeRect(15, 15, 770, 270);

            // Avatar
            try {
                const avatarURL = interaction.user.displayAvatarURL({ extension: 'png', size: 128 });
                const avatar = await loadImage(avatarURL);
                ctx.save();
                ctx.beginPath();
                ctx.arc(150, 150, 60, 0, Math.PI * 2);
                ctx.closePath();
                ctx.clip();
                ctx.drawImage(avatar, 90, 90, 120, 120);
                ctx.restore();

                // Avatar border
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.arc(150, 150, 62, 0, Math.PI * 2);
                ctx.stroke();
            } catch (error) {
                console.log('Failed to load avatar, using default');
            }

            // Username
            ctx.fillStyle = userCard.textColor || serverCard.textColor || '#ffffff';
            ctx.font = 'bold 32px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(interaction.user.username, 250, 120);

            // Level
            ctx.fillStyle = userCard.accentColor || serverCard.accentColor || '#ffeb3b';
            ctx.font = 'bold 48px Arial';
            ctx.fillText(`Level ${userData.level}`, 250, 180);

            // XP
            ctx.fillStyle = userCard.textColor || serverCard.textColor || '#ffffff';
            ctx.font = '24px Arial';
            ctx.fillText(`${userData.xp} XP`, 250, 220);

            // Progress bar background
            ctx.fillStyle = userCard.textColor || serverCard.textColor || '#ffffff';
            ctx.fillRect(250, 240, 400, 20);

            // Progress bar fill
            const xpForCurrentLevel = (userData.level - 1) * 50;
            const xpForNextLevel = userData.level * 50;
            const progress = (userData.xp - xpForCurrentLevel) / (xpForNextLevel - xpForCurrentLevel);
            ctx.fillStyle = userCard.progressColor || serverCard.progressColor || '#4caf50';
            ctx.fillRect(250, 240, 400 * progress, 20);

            // Progress text
            ctx.fillStyle = '#000000';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`${userData.xp - xpForCurrentLevel}/${xpForNextLevel - xpForCurrentLevel} XP to next level`, 450, 275);

            // Convert canvas to buffer
            const buffer = canvas.toBuffer();
            const attachment = new AttachmentBuilder(buffer, { name: 'level-card.png' });

            // Calculate progress to next level
            const currentLevelXP = userData.xp - xpForCurrentLevel;
            const requiredXP = xpForNextLevel - xpForCurrentLevel;
            const progressPercent = Math.round((currentLevelXP / requiredXP) * 100);

            const embed = new EmbedBuilder()
                .setColor(userCard.accentColor || serverCard.accentColor || '#FFD700')
                .setTitle(`🏆 ${interaction.user.displayName}'s Voice Level Card`)
                .setDescription(`*Voice activity level and experience points*`)
                .setImage('attachment://level-card.png')
                .addFields(
                    { name: '📊 Level', value: `**${userData.level}**`, inline: true },
                    { name: '⭐ XP', value: `**${userData.xp.toLocaleString()}**`, inline: true },
                    { name: '📈 Progress', value: `**${currentLevelXP}/${requiredXP} XP** (${progressPercent}%)`, inline: true }
                )
                .setFooter({
                    text: `Keep chatting in voice channels to level up! | ${interaction.guild.name}`,
                    iconURL: interaction.guild.iconURL({ dynamic: true, size: 32 })
                })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed], files: [attachment] });

        } catch (error) {
            console.error('Error fetching user level:', error);
            await interaction.editReply({ content: 'There was an error fetching your level.' });
        }
    },
};
