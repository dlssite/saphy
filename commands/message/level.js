const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
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

// Helper function to draw rounded rectangle
function drawRoundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

module.exports = {
    name: 'level',
    aliases: ['lvl', 'rank'],
    description: 'Checks your current voice activity level with a beautiful card.',

    async execute(message, args, client) {
        try {
            const userId = message.author.id;
            const guildId = message.guild.id;

            const userData = await getUserLevelAndXP(userId, guildId);

            if (!userData) {
                return message.reply('You haven\'t gained any voice activity yet!');
            }

            // Get server and user customizations
            const server = await require('../../models/Server').findById(guildId) || {};
            const serverCard = server.levelCard || {};
            const userCard = server.userLevelCards?.[userId] || {};
            const xpPerLevel = server.settings?.levelingXPPerLevel || 100;

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

            // Add shadow effect
            ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            ctx.shadowBlur = 10;
            ctx.shadowOffsetX = 5;
            ctx.shadowOffsetY = 5;

            // Main card background with rounded corners
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            drawRoundedRect(ctx, 20, 20, 760, 260, 30);
            ctx.fill();

            // Reset shadow
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;

            // Inner border
            ctx.strokeStyle = userCard.accentColor || serverCard.accentColor || '#ffeb3b';
            ctx.lineWidth = 3;
            drawRoundedRect(ctx, 25, 25, 750, 250, 25);
            ctx.stroke();

            // Avatar
            try {
                const avatarURL = message.author.displayAvatarURL({ extension: 'png', size: 128 });
                const avatar = await loadImage(avatarURL);
                ctx.save();
                ctx.beginPath();
                ctx.arc(120, 150, 70, 0, Math.PI * 2);
                ctx.closePath();
                ctx.clip();
                ctx.drawImage(avatar, 50, 80, 140, 140);
                ctx.restore();

                // Avatar border
                ctx.strokeStyle = userCard.accentColor || serverCard.accentColor || '#ffeb3b';
                ctx.lineWidth = 5;
                ctx.beginPath();
                ctx.arc(120, 150, 72, 0, Math.PI * 2);
                ctx.stroke();
            } catch (error) {
                console.log('Failed to load avatar, using default');
            }

            // Username
            ctx.fillStyle = userCard.textColor || serverCard.textColor || '#ffffff';
            ctx.font = 'bold 36px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(message.author.username, 220, 110);

            // Level
            ctx.fillStyle = userCard.accentColor || serverCard.accentColor || '#ffeb3b';
            ctx.font = 'bold 52px Arial';
            ctx.fillText(`Level ${userData.level}`, 220, 170);

            // XP
            ctx.fillStyle = userCard.textColor || serverCard.textColor || '#ffffff';
            ctx.font = '28px Arial';
            ctx.fillText(`${userData.xp.toLocaleString()} XP`, 220, 210);

            // Progress bar background
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            drawRoundedRect(ctx, 220, 230, 500, 25, 12);
            ctx.fill();

            // Progress bar fill
            const xpForCurrentLevel = (userData.level - 1) * xpPerLevel;
            const xpForNextLevel = userData.level * xpPerLevel;
            const progress = (userData.xp - xpForCurrentLevel) / (xpForNextLevel - xpForCurrentLevel);
            ctx.fillStyle = userCard.progressColor || serverCard.progressColor || '#4caf50';
            drawRoundedRect(ctx, 220, 230, 500 * progress, 25, 12);
            ctx.fill();

            // Progress text
            ctx.fillStyle = '#ffffff';
            ctx.font = '18px Arial';
            ctx.textAlign = 'center';
            const currentLevelXP = userData.xp - xpForCurrentLevel;
            const requiredXP = xpForNextLevel - xpForCurrentLevel;
            ctx.fillText(`${currentLevelXP}/${requiredXP} XP`, 470, 248);

            // Convert canvas to buffer
            const buffer = canvas.toBuffer();
            const attachment = new AttachmentBuilder(buffer, { name: 'level-card.png' });

            await message.reply({ files: [attachment] });

        } catch (error) {
            console.error('Error fetching user level:', error);
            await message.reply('There was an error fetching your level.');
        }
    }
};
