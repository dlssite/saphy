const { EmbedBuilder, Events, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const Server = require('../models/Server');

async function handleSecureMusicButton(interaction, client) {
    if (interaction.customId === 'music_support') return;

    const ConditionChecker = require('../utils/checks');
    const checker = new ConditionChecker(client);

    try {
        const conditions = await checker.checkMusicConditions(
            interaction.guild.id,
            interaction.user.id,
            interaction.member.voice?.channelId,
            true
        );

        if (!conditions.hasActivePlayer) {
            return interaction.reply({
                content: '❌ No music is currently playing!',
                ephemeral: true
            });
        }

        if (!conditions.userInVoice) {
            return interaction.reply({
                content: '❌ You need to be in a voice channel to control music!',
                ephemeral: true
            });
        }

        if (!conditions.sameVoiceChannel) {
            const botChannelName = interaction.guild.channels.cache.get(conditions.botVoiceChannel)?.name || 'Unknown';
            return interaction.reply({
                content: `❌ You need to be in **${botChannelName}** voice channel to control music!`,
                ephemeral: true
            });
        }

        const canUseMusic = await checker.canUseMusic(interaction.guild.id, interaction.user.id);
        if (!canUseMusic) {
            return interaction.reply({
                content: '❌ You need DJ permissions to control music!',
                ephemeral: true
            });
        }

        const player = conditions.player;
        const action = interaction.customId.replace('music_', '');
        const CentralEmbedHandler = require('../utils/centralEmbed');
        const centralHandler = new CentralEmbedHandler(client);

        switch (action) {
            case 'pause':
                player.pause(true);
                await interaction.reply({
                    content: '⏸️ Music paused',
                    ephemeral: true
                });
                await updateCentralEmbed();
                break;

            case 'resume':
                player.pause(false);
                await interaction.reply({
                    content: '▶️ Music resumed',
                    ephemeral: true
                });
                await updateCentralEmbed();
                break;

            case 'skip':
                const currentTrack = player.current?.info?.title || 'Unknown';
                player.stop();
                await interaction.reply({
                    content: `⏭️ Skipped: \`${currentTrack}\``,
                    ephemeral: true
                });
                break;

            case 'stop':
                player.destroy();
                await interaction.reply({
                    content: '🛑 Music stopped and disconnected',
                    ephemeral: true
                });
                break;

            case 'clear':
                const clearedCount = player.queue.size;
                player.queue.clear();
                await interaction.reply({
                    content: `🗑️ Cleared ${clearedCount} songs from queue`,
                    ephemeral: true
                });
                await updateCentralEmbed();
                break;

            case 'loop':
                const currentLoop = player.loop || 'none';
                let newLoop;

                switch (currentLoop) {
                    case 'none': newLoop = 'track'; break;
                    case 'track': newLoop = 'queue'; break;
                    case 'queue': newLoop = 'none'; break;
                    default: newLoop = 'track';
                }

                player.setLoop(newLoop);
                const loopEmojis = { none: '➡️', track: '🔂', queue: '🔁' };
                await interaction.reply({
                    content: `${loopEmojis[newLoop]} Loop mode: **${newLoop}**`,
                    ephemeral: true
                });
                await updateCentralEmbed();
                break;

            case 'volume_up':
                const newVolumeUp = Math.min(player.volume + 10, 100);
                player.setVolume(newVolumeUp);
                await interaction.reply({
                    content: `🔊 Volume increased to ${newVolumeUp}%`,
                    ephemeral: true
                });
                await updateCentralEmbed();
                break;

            case 'volume_down':
                const newVolumeDown = Math.max(player.volume - 10, 1);
                player.setVolume(newVolumeDown);
                await interaction.reply({
                    content: `🔉 Volume decreased to ${newVolumeDown}%`,
                    ephemeral: true
                });
                await updateCentralEmbed();
                break;

            case 'queue':
                if (player.queue.size === 0) {
                    return interaction.reply({
                        content: '📜 Queue is empty',
                        ephemeral: true
                    });
                }

                const queueList = player.queue.map((track, index) =>
                    `\`${index + 1}.\` ${track.info.title.substring(0, 40)}${track.info.title.length > 40 ? '...' : ''}`
                ).slice(0, 10).join('\n');

                const moreText = player.queue.size > 10 ? `\n... and ${player.queue.size - 10} more songs` : '';

                await interaction.reply({
                    content: `📜 **Queue (${player.queue.size} songs)**\n${queueList}${moreText}`,
                    ephemeral: true
                });
                break;

            case 'shuffle':
                if (player.queue.size === 0) {
                    return interaction.reply({
                        content: '❌ Queue is empty, nothing to shuffle!',
                        ephemeral: true
                    });
                }

                player.queue.shuffle();
                await interaction.reply({
                    content: `🔀 Shuffled ${player.queue.size} songs in queue`,
                    ephemeral: true
                });
                break;

            default:
                await interaction.reply({
                    content: '❌ Unknown button action',
                    ephemeral: true
                });
        }

        async function updateCentralEmbed() {
            if (player && player.current) {
                const playerInfo = {
                    title: player.current.info.title,
                    author: player.current.info.author,
                    duration: player.current.info.length,
                    thumbnail: player.current.info.thumbnail,
                    requester: player.current.info.requester,
                    paused: player.paused,
                    volume: player.volume,
                    loop: player.loop,
                    queueLength: player.queue.size
                };
                await centralHandler.updateCentralEmbed(interaction.guild.id, playerInfo);
            }
        }

    } catch (error) {
        console.error('Error handling secure music button:', error);
        await interaction.reply({
            content: '❌ An error occurred while processing your request',
            ephemeral: true
        }).catch(() => {});
    }
}

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        if (interaction.isModalSubmit()) {
            if (interaction.customId === 'leveling_customization_modal') {
                const imageUrl = interaction.fields.getTextInputValue('image_url');
                const embedColor = interaction.fields.getTextInputValue('embed_color');
                const messagesString = interaction.fields.getTextInputValue('leveling_messages');

                const guildId = interaction.guild.id;
                const updateData = {};

                if (imageUrl) updateData['settings.levelingNotificationImage'] = imageUrl;
                if (embedColor) {
                    const hexRegex = /^#[0-9A-F]{6}$/i;
                    if (!hexRegex.test(embedColor)) {
                        return await interaction.reply({
                            content: '❌ Invalid hex color code. Please use format like #ff0000.',
                            ephemeral: true
                        });
                    }
                    updateData['settings.levelingEmbedColor'] = embedColor;
                }
                if (messagesString) {
                    const messages = messagesString.split('|').map(msg => msg.trim()).filter(msg => msg.length > 0);
                    updateData['settings.levelingMessages'] = messages;
                }

                try {
                    await Server.findOneAndUpdate(
                        { _id: guildId },
                        updateData,
                        { upsert: true, new: true }
                    );

                    const embed = new EmbedBuilder()
                        .setColor('#00ff00')
                        .setDescription('✅ Level up customization has been updated successfully!');

                    await interaction.reply({ embeds: [embed], ephemeral: true });

                } catch (error) {
                    console.error('Error updating leveling customization:', error);
                    const embed = new EmbedBuilder()
                        .setColor('#ff0000')
                        .setDescription('❌ There was an error updating the leveling customization.');

                    await interaction.reply({ embeds: [embed], ephemeral: true });
                }
            }

            // Handle level card modals
            if (interaction.customId === 'level_card_colors_modal') {
                const backgroundColor = interaction.fields.getTextInputValue('background_color');
                const accentColor = interaction.fields.getTextInputValue('accent_color');
                const textColor = interaction.fields.getTextInputValue('text_color');
                const progressColor = interaction.fields.getTextInputValue('progress_color');

                const guildId = interaction.guild.id;
                const updateData = { $set: {} };

                const hexRegex = /^#[0-9A-F]{6}$/i;

                if (backgroundColor) {
                    if (!hexRegex.test(backgroundColor)) {
                        return await interaction.reply({
                            content: '❌ Invalid background color hex code. Please use format like #1a1a2e.',
                            ephemeral: true
                        });
                    }
                    updateData.$set['levelCard.backgroundColor'] = backgroundColor;
                }
                if (accentColor) {
                    if (!hexRegex.test(accentColor)) {
                        return await interaction.reply({
                            content: '❌ Invalid accent color hex code. Please use format like #ffeb3b.',
                            ephemeral: true
                        });
                    }
                    updateData.$set['levelCard.accentColor'] = accentColor;
                }
                if (textColor) {
                    if (!hexRegex.test(textColor)) {
                        return await interaction.reply({
                            content: '❌ Invalid text color hex code. Please use format like #ffffff.',
                            ephemeral: true
                        });
                    }
                    updateData.$set['levelCard.textColor'] = textColor;
                }
                if (progressColor) {
                    if (!hexRegex.test(progressColor)) {
                        return await interaction.reply({
                            content: '❌ Invalid progress color hex code. Please use format like #4caf50.',
                            ephemeral: true
                        });
                    }
                    updateData.$set['levelCard.progressColor'] = progressColor;
                }

                try {
                    await Server.findOneAndUpdate(
                        { _id: guildId },
                        updateData,
                        { upsert: true, new: true }
                    );

                    const embed = new EmbedBuilder()
                        .setColor('#00ff00')
                        .setDescription('✅ Level card colors have been updated successfully!');

                    await interaction.reply({ embeds: [embed], ephemeral: true });

                } catch (error) {
                    console.error('Error updating level card colors:', error);
                    const embed = new EmbedBuilder()
                        .setColor('#ff0000')
                        .setDescription('❌ There was an error updating the level card colors.');

                    await interaction.reply({ embeds: [embed], ephemeral: true });
                }
            }

            if (interaction.customId === 'level_card_image_modal') {
                const imageUrl = interaction.fields.getTextInputValue('background_image_url');

                const guildId = interaction.guild.id;
                const updateData = { $set: {} };

                if (imageUrl) {
                    // Basic URL validation
                    try {
                        new URL(imageUrl);
                        updateData.$set['levelCard.backgroundImage'] = imageUrl;
                    } catch (error) {
                        return await interaction.reply({
                            content: '❌ Invalid URL format. Please provide a valid image URL.',
                            ephemeral: true
                        });
                    }
                } else {
                    updateData.$set['levelCard.backgroundImage'] = null;
                }

                try {
                    await Server.findOneAndUpdate(
                        { _id: guildId },
                        updateData,
                        { upsert: true, new: true }
                    );

                    const embed = new EmbedBuilder()
                        .setColor('#00ff00')
                        .setDescription(imageUrl ? '✅ Level card background image has been set!' : '✅ Level card background image has been removed!');

                    await interaction.reply({ embeds: [embed], ephemeral: true });

                } catch (error) {
                    console.error('Error updating level card image:', error);
                    const embed = new EmbedBuilder()
                        .setColor('#ff0000')
                        .setDescription('❌ There was an error updating the level card background image.');

                    await interaction.reply({ embeds: [embed], ephemeral: true });
                }
            }



            // Handle personal level card modals
            if (interaction.customId === 'personal_level_card_colors_modal') {
                await interaction.deferReply({ ephemeral: true });

                const backgroundColor = interaction.fields.getTextInputValue('personal_background_color');
                const accentColor = interaction.fields.getTextInputValue('personal_accent_color');
                const textColor = interaction.fields.getTextInputValue('personal_text_color');
                const progressColor = interaction.fields.getTextInputValue('personal_progress_color');

                const guildId = interaction.guild.id;
                const userId = interaction.user.id;

                const hexRegex = /^#[0-9A-F]{6}$/i;

                if (backgroundColor && !hexRegex.test(backgroundColor)) {
                    return await interaction.editReply({
                        content: '❌ Invalid background color hex code. Please use format like #1a1a2e.'
                    });
                }
                if (accentColor && !hexRegex.test(accentColor)) {
                    return await interaction.editReply({
                        content: '❌ Invalid accent color hex code. Please use format like #ffeb3b.'
                    });
                }
                if (textColor && !hexRegex.test(textColor)) {
                    return await interaction.editReply({
                        content: '❌ Invalid text color hex code. Please use format like #ffffff.'
                    });
                }
                if (progressColor && !hexRegex.test(progressColor)) {
                    return await interaction.editReply({
                        content: '❌ Invalid progress color hex code. Please use format like #4caf50.'
                    });
                }

                try {
                    let server = await Server.findById(guildId);
                    if (!server) {
                        server = new Server({ _id: guildId });
                    }
                    if (!server.userLevelCards) {
                        server.userLevelCards = {};
                    }
                    if (!server.userLevelCards[userId]) {
                        server.userLevelCards[userId] = {};
                    }
                    const userCard = server.userLevelCards[userId];
                    if (backgroundColor) userCard.backgroundColor = backgroundColor;
                    if (accentColor) userCard.accentColor = accentColor;
                    if (textColor) userCard.textColor = textColor;
                    if (progressColor) userCard.progressColor = progressColor;
                    server.markModified('userLevelCards');
                    await server.save();

                    const embed = new EmbedBuilder()
                        .setColor('#00ff00')
                        .setDescription('✅ Your personal level card colors have been updated successfully!');

                    await interaction.editReply({ embeds: [embed] });

                } catch (error) {
                    console.error('Error updating personal level card colors:', error);
                    const embed = new EmbedBuilder()
                        .setColor('#ff0000')
                        .setDescription('❌ There was an error updating your personal level card colors.');

                    await interaction.editReply({ embeds: [embed] });
                }
            }

            if (interaction.customId === 'personal_level_card_image_modal') {
                await interaction.deferReply({ ephemeral: true });

                const imageUrl = interaction.fields.getTextInputValue('personal_background_image_url');

                const guildId = interaction.guild.id;
                const userId = interaction.user.id;

                if (imageUrl) {
                    // Basic URL validation
                    try {
                        new URL(imageUrl);
                    } catch (error) {
                        return await interaction.editReply({
                            content: '❌ Invalid URL format. Please provide a valid image URL.'
                        });
                    }
                }

                try {
                    let server = await Server.findById(guildId);
                    if (!server) {
                        server = new Server({ _id: guildId });
                    }
                    if (!server.userLevelCards) {
                        server.userLevelCards = {};
                    }
                    if (!server.userLevelCards[userId]) {
                        server.userLevelCards[userId] = {};
                    }
                    const userCard = server.userLevelCards[userId];
                    userCard.backgroundImage = imageUrl || null;
                    server.markModified('userLevelCards');
                    await server.save();

                    const embed = new EmbedBuilder()
                        .setColor('#00ff00')
                        .setDescription(imageUrl ? '✅ Your personal level card background image has been set!' : '✅ Your personal level card background image has been removed!');

                    await interaction.editReply({ embeds: [embed] });

                } catch (error) {
                    console.error('Error updating personal level card image:', error);
                    const embed = new EmbedBuilder()
                        .setColor('#ff0000')
                        .setDescription('❌ There was an error updating your personal level card background image.');

                    await interaction.editReply({ embeds: [embed] });
                }
            }
        }

        if (interaction.isStringSelectMenu()) {
            if (interaction.customId === 'level_card_roles_select') {
                const selectedRoleIds = interaction.values;
                const guildId = interaction.guild.id;
                const updateData = { $set: {} };

                updateData.$set['levelCard.allowedRoles'] = selectedRoleIds;

                try {
                    await Server.findOneAndUpdate(
                        { _id: guildId },
                        updateData,
                        { upsert: true, new: true }
                    );

                    const embed = new EmbedBuilder()
                        .setColor('#00ff00')
                        .setDescription(`✅ Allowed roles for level card customization have been updated! Selected ${selectedRoleIds.length} role(s).`);

                    await interaction.reply({ embeds: [embed], ephemeral: true });

                } catch (error) {
                    console.error('Error updating allowed roles:', error);
                    const embed = new EmbedBuilder()
                        .setColor('#ff0000')
                        .setDescription('❌ There was an error updating the allowed roles.');

                    await interaction.reply({ embeds: [embed], ephemeral: true });
                }
            }
            return;
        }

        if (!interaction.isButton()) return;

        // Handle level card customization buttons
        if (interaction.customId.startsWith('level_card_')) {
            const action = interaction.customId.replace('level_card_', '');
            const guildId = interaction.guild.id;

            if (action === 'colors') {
                const modal = new ModalBuilder()
                    .setCustomId('level_card_colors_modal')
                    .setTitle('Set Level Card Colors');

                const backgroundColorInput = new TextInputBuilder()
                    .setCustomId('background_color')
                    .setLabel('Background Color (Hex code, e.g., #1a1a2e)')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('#1a1a2e')
                    .setRequired(false);

                const accentColorInput = new TextInputBuilder()
                    .setCustomId('accent_color')
                    .setLabel('Accent Color (Hex code, e.g., #ffeb3b)')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('#ffeb3b')
                    .setRequired(false);

                const textColorInput = new TextInputBuilder()
                    .setCustomId('text_color')
                    .setLabel('Text Color (Hex code, e.g., #ffffff)')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('#ffffff')
                    .setRequired(false);

                const progressColorInput = new TextInputBuilder()
                    .setCustomId('progress_color')
                    .setLabel('Progress Bar Color (Hex code, e.g., #4caf50)')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('#4caf50')
                    .setRequired(false);

                const firstActionRow = new ActionRowBuilder().addComponents(backgroundColorInput);
                const secondActionRow = new ActionRowBuilder().addComponents(accentColorInput);
                const thirdActionRow = new ActionRowBuilder().addComponents(textColorInput);
                const fourthActionRow = new ActionRowBuilder().addComponents(progressColorInput);

                modal.addComponents(firstActionRow, secondActionRow, thirdActionRow, fourthActionRow);

                await interaction.showModal(modal);
            } else if (action === 'image') {
                const modal = new ModalBuilder()
                    .setCustomId('level_card_image_modal')
                    .setTitle('Set Level Card Background Image');

                const imageUrlInput = new TextInputBuilder()
                    .setCustomId('background_image_url')
                    .setLabel('Background Image URL')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('https://example.com/image.png')
                    .setRequired(false);

                const firstActionRow = new ActionRowBuilder().addComponents(imageUrlInput);

                modal.addComponents(firstActionRow);

                await interaction.showModal(modal);
            } else if (action === 'roles') {
                const roles = interaction.guild.roles.cache
                    .filter(role => role.name !== '@everyone')
                    .map(role => ({
                        label: role.name.length > 25 ? role.name.substring(0, 22) + '...' : role.name,
                        value: role.id,
                        description: `ID: ${role.id}`
                    }))
                    .slice(0, 25); // Discord limit: 25 options max

                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('level_card_roles_select')
                    .setPlaceholder('Select allowed roles for level card customization')
                    .addOptions(roles)
                    .setMaxValues(roles.length);

                const row = new ActionRowBuilder().addComponents(selectMenu);

                const embed = new EmbedBuilder()
                    .setColor('#0099ff')
                    .setTitle('Select Allowed Roles')
                    .setDescription('Choose which roles are allowed to customize level cards. Multiple selections allowed.');

                await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
            } else if (action === 'reset') {
                try {
                    await Server.findOneAndUpdate(
                        { _id: guildId },
                        { $unset: { levelCard: 1 } },
                        { upsert: true }
                    );

                    const embed = new EmbedBuilder()
                        .setColor('#00ff00')
                        .setDescription('✅ Level card settings have been reset to default!');

                    await interaction.reply({ embeds: [embed], ephemeral: true });
                } catch (error) {
                    console.error('Error resetting level card settings:', error);
                    const embed = new EmbedBuilder()
                        .setColor('#ff0000')
                        .setDescription('❌ There was an error resetting the level card settings.');

                    await interaction.reply({ embeds: [embed], ephemeral: true });
                }
            }
            return;
        }

        // Handle personal level card customization buttons
        if (interaction.customId.startsWith('personal_level_card_')) {
            const action = interaction.customId.replace('personal_level_card_', '');
            const guildId = interaction.guild.id;
            const userId = interaction.user.id;

            if (action === 'colors') {
                const modal = new ModalBuilder()
                    .setCustomId('personal_level_card_colors_modal')
                    .setTitle('Set Personal Level Card Colors');

                const backgroundColorInput = new TextInputBuilder()
                    .setCustomId('personal_background_color')
                    .setLabel('Background Color (Hex code, e.g., #1a1a2e)')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('#1a1a2e')
                    .setRequired(false);

                const accentColorInput = new TextInputBuilder()
                    .setCustomId('personal_accent_color')
                    .setLabel('Accent Color (Hex code, e.g., #ffeb3b)')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('#ffeb3b')
                    .setRequired(false);

                const textColorInput = new TextInputBuilder()
                    .setCustomId('personal_text_color')
                    .setLabel('Text Color (Hex code, e.g., #ffffff)')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('#ffffff')
                    .setRequired(false);

                const progressColorInput = new TextInputBuilder()
                    .setCustomId('personal_progress_color')
                    .setLabel('Progress Bar Color (Hex code, e.g., #4caf50)')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('#4caf50')
                    .setRequired(false);

                const firstActionRow = new ActionRowBuilder().addComponents(backgroundColorInput);
                const secondActionRow = new ActionRowBuilder().addComponents(accentColorInput);
                const thirdActionRow = new ActionRowBuilder().addComponents(textColorInput);
                const fourthActionRow = new ActionRowBuilder().addComponents(progressColorInput);

                modal.addComponents(firstActionRow, secondActionRow, thirdActionRow, fourthActionRow);

                await interaction.showModal(modal);
            } else if (action === 'image') {
                const modal = new ModalBuilder()
                    .setCustomId('personal_level_card_image_modal')
                    .setTitle('Set Personal Level Card Background Image');

                const imageUrlInput = new TextInputBuilder()
                    .setCustomId('personal_background_image_url')
                    .setLabel('Background Image URL')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('https://example.com/image.png')
                    .setRequired(false);

                const firstActionRow = new ActionRowBuilder().addComponents(imageUrlInput);

                modal.addComponents(firstActionRow);

                await interaction.showModal(modal);
            } else if (action === 'reset') {
                try {
                    await Server.findOneAndUpdate(
                        { _id: guildId },
                        { $unset: { [`userLevelCards.${userId}`]: 1 } },
                        { upsert: true }
                    );

                    const embed = new EmbedBuilder()
                        .setColor('#00ff00')
                        .setDescription('✅ Your personal level card settings have been reset to server default!');

                    await interaction.reply({ embeds: [embed], ephemeral: true });
                } catch (error) {
                    console.error('Error resetting personal level card settings:', error);
                    const embed = new EmbedBuilder()
                        .setColor('#ff0000')
                        .setDescription('❌ There was an error resetting your personal level card settings.');

                    await interaction.reply({ embeds: [embed], ephemeral: true });
                }
            }
            return;
        }

        // Handle leaderboard pagination buttons
        if (interaction.customId === 'leaderboard_prev' || interaction.customId === 'leaderboard_next') {
            const cache = global.leaderboardCache?.get(interaction.message.id);
            if (!cache || cache.userId !== interaction.user.id) {
                return interaction.reply({
                    content: '❌ This leaderboard is not for you or has expired.',
                    ephemeral: true
                });
            }

            let newPage = cache.page;
            if (interaction.customId === 'leaderboard_prev') {
                newPage = Math.max(0, cache.page - 1);
            } else {
                newPage = Math.min(cache.totalPages - 1, cache.page + 1);
            }

            if (newPage === cache.page) return; // No change

            const embed = await buildLeaderboardEmbed(interaction, cache.leaderboard, newPage, cache.totalPages);
            const components = buildPaginationComponents(newPage, cache.totalPages);

            await interaction.update({ embeds: [embed], components });

            // Update cache
            cache.page = newPage;
            global.leaderboardCache.set(interaction.message.id, cache);
            return;
        }

        // Handle button interactions here
        await handleSecureMusicButton(interaction, interaction.client);
    },
};

module.exports.handleSecureMusicButton = handleSecureMusicButton;
