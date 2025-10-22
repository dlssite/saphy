const { EmbedBuilder } = require('discord.js');
const User = require('../models/User'); // Your User model
const Server = require('../models/Server'); // Import Server model
const { calculateXP, calculateLevel } = require('../utils/voiceLeveling'); // Your leveling functions
const { createLevelUpEmbed } = require('../utils/voiceLeveling'); // Import the embed creation function
// Store user join timestamps
const userJoinTimestamps = new Map();
// Store active XP awarding intervals per user
const userXPIntervals = new Map();
 
module.exports = {
    name: 'voiceStateUpdate',
    async execute(oldState, newState, client) {
        const userId = oldState.member.id;
        const guildId = oldState.guild?.id; // Use optional chaining

        if (!guildId || oldState.member.user.bot) { // Ignore bots and DMs
 return;
        }

        // User joined a voice channel
        if (!oldState.channelId && newState.channelId) {
            // Ignore bots and AFK channel joins
            if (newState.member.user.bot || newState.channelId === newState.guild?.afkChannelId) {
                console.log(`[Voice XP] Ignoring bot or AFK channel join for user ${newState.member.user.tag} in guild ${newState.guild?.name}`);
                return;
            }
            // Store the join timestamp for non-bot users
            userJoinTimestamps.set(userId, Date.now());
            console.log(`User ${oldState.member.user.tag} joined voice channel ${newState.channel.name} in guild ${oldState.guild.name}`);

            // Start real-time XP awarding interval
            const interval = setInterval(async () => {
                try {
                    let user = await User.findOne({ discordId: userId });
                    if (!user) {
                        user = new User({ discordId: userId });
                    } else {
                        if (user.xp === undefined) user.xp = 0;
                        if (user.level === undefined) user.level = 1;
                    }

                    const oldLevel = user.level;
                    user.xp += calculateXP(60); // Award XP for 60 seconds
                    user.level = calculateLevel(user.xp);
                    console.log(`[Voice XP] User ${newState.member.user.tag} gained ${calculateXP(60)} XP. New XP: ${user.xp}, New Level: ${user.level}`);

                    await user.save();

                    // Notify user if they leveled up
                    if (user.level > oldLevel && newState.guild) {
                        const member = await newState.guild.members.fetch(userId);
                        const levelUpEmbed = await createLevelUpEmbed(member, user.level, guildId);

                        const serverSettings = await Server.findOne({ guildId: guildId });
                        let levelChannel = null;

                        if (serverSettings && serverSettings.levelingChannelId) {
                            levelChannel = newState.guild.channels.cache.get(serverSettings.levelingChannelId);
                        }

                        const systemChannel = newState.guild?.systemChannel;

                        if (levelChannel) {
                            console.log(`Sending level up message to configured channel for guild ${newState.guild.name}`);
                            levelChannel.send({ content: `<@${userId}>`, embeds: [levelUpEmbed] }).catch(console.error);
                        } else if (systemChannel) {
                            systemChannel.send({ content: `<@${userId}>`, embeds: [levelUpEmbed] }).catch(console.error);
                        } else {
                            console.warn(`No channel found to send level up message for guild ${newState.guild.name}`);
                        }
                    }
                } catch (error) {
                    console.error('Error updating user voice level in real-time:', error);
                }
            }, 60000); // Every 60 seconds

            userXPIntervals.set(userId, interval);
        }

        // User left a voice channel
        if (oldState.channelId && !newState.channelId) {
            // Clear the XP awarding interval
            const interval = userXPIntervals.get(userId);
            if (interval) {
                clearInterval(interval);
                userXPIntervals.delete(userId);
            }

            const joinTimestamp = userJoinTimestamps.get(userId);

            // If we have a join timestamp for this user and they are leaving
            if (joinTimestamp) {
                // Check if the channel left was the AFK channel. If so, just delete the timestamp and return.
                if (oldState.channelId === oldState.guild?.afkChannelId) {
                    console.log(`[Voice XP] User ${oldState.member.user.tag} left AFK channel in guild ${oldState.guild?.name}. Not awarding XP.`);
                    userJoinTimestamps.delete(userId);
                    return;
                }

                const durationInSeconds = Math.floor((Date.now() - joinTimestamp) / 1000);
                console.log(`User ${oldState.member.user.tag} left voice channel ${oldState.channel.name} after ${durationInSeconds} seconds in guild ${oldState.guild.name}`);
                console.log(`[Voice XP] User ${oldState.member.user.tag} in guild ${oldState.guild.name} was in voice for ${durationInSeconds} seconds.`);
                userJoinTimestamps.delete(userId);

                // Award remaining XP for the time not covered by intervals
                const remainingSeconds = durationInSeconds % 60;
                if (remainingSeconds > 0) {
                    const xpGained = calculateXP(remainingSeconds);

                    try {
                        // Find or create the user in the database
                        let user = await User.findOne({ discordId: userId }); // Find by discordId

                        if (!user) {
                            user = new User({ discordId: userId });
                        } else {
                            // Ensure the user object has the necessary properties
                            if (user.xp === undefined) user.xp = 0;
                            if (user.level === undefined) user.level = 1;
                        }

                        const oldLevel = user.level;
                        user.xp += xpGained;
                        user.level = calculateLevel(user.xp);
                        console.log(`[Voice XP] User ${oldState.member.user.tag} gained ${xpGained} XP for remaining time. New XP: ${user.xp}, New Level: ${user.level}`);

                        await user.save();

                        // Notify user if they leveled up
                        if (user.level > oldLevel && oldState.guild) { // Ensure guild is available
                            const member = await oldState.guild.members.fetch(userId);
                            const levelUpEmbed = await createLevelUpEmbed(member, user.level, guildId);

                            const serverSettings = await Server.findOne({ guildId: guildId });
                            let levelChannel = null;

                            if (serverSettings && serverSettings.levelingChannelId) {
                                levelChannel = oldState.guild.channels.cache.get(serverSettings.levelingChannelId);
                            }

                            const systemChannel = oldState.guild?.systemChannel;

                            if (levelChannel) {
                                console.log(`Sending level up message to configured channel for guild ${oldState.guild.name}`);
                                levelChannel.send({ content: `<@${userId}>`, embeds: [levelUpEmbed] }).catch(console.error);
                            } else if (systemChannel) {
                                systemChannel.send({ content: `<@${userId}>`, embeds: [levelUpEmbed] }).catch(console.error);
                            } else {
                                console.warn(`No channel found to send level up message for guild ${oldState.guild.name}`);
                            }
                        }

                    } catch (error) {
                        console.error('Error updating user voice level on leave:', error);
                    }
                }
            }
        }

        // User moved to a different channel
        if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
            // Clear the old interval
            const interval = userXPIntervals.get(userId);
            if (interval) {
                clearInterval(interval);
                userXPIntervals.delete(userId);
            }

            // Ignore if moving to AFK channel
            if (newState.channelId === newState.guild?.afkChannelId) {
                console.log(`[Voice XP] User ${newState.member.user.tag} moved to AFK channel in guild ${newState.guild?.name}. Stopping XP.`);
                return;
            }

            // Start new interval for the new channel
            const newInterval = setInterval(async () => {
                try {
                    let user = await User.findOne({ discordId: userId });
                    if (!user) {
                        user = new User({ discordId: userId });
                    } else {
                        if (user.xp === undefined) user.xp = 0;
                        if (user.level === undefined) user.level = 1;
                    }

                    const oldLevel = user.level;
                    user.xp += calculateXP(60); // Award XP for 60 seconds
                    user.level = calculateLevel(user.xp);
                    console.log(`[Voice XP] User ${newState.member.user.tag} gained ${calculateXP(60)} XP. New XP: ${user.xp}, New Level: ${user.level}`);

                    await user.save();

                    // Notify user if they leveled up
                    if (user.level > oldLevel && newState.guild) {
                        const member = await newState.guild.members.fetch(userId);
                        const levelUpEmbed = await createLevelUpEmbed(member, user.level, guildId);

                        const serverSettings = await Server.findOne({ guildId: guildId });
                        let levelChannel = null;

                        if (serverSettings && serverSettings.levelingChannelId) {
                            levelChannel = newState.guild.channels.cache.get(serverSettings.levelingChannelId);
                        }

                        const systemChannel = newState.guild?.systemChannel;

                        if (levelChannel) {
                            console.log(`Sending level up message to configured channel for guild ${newState.guild.name}`);
                            levelChannel.send({ content: `<@${userId}>`, embeds: [levelUpEmbed] }).catch(console.error);
                        } else if (systemChannel) {
                            systemChannel.send({ content: `<@${userId}>`, embeds: [levelUpEmbed] }).catch(console.error);
                        } else {
                            console.warn(`No channel found to send level up message for guild ${newState.guild.name}`);
                        }
                    }
                } catch (error) {
                    console.error('Error updating user voice level in real-time:', error);
                }
            }, 60000); // Every 60 seconds

            userXPIntervals.set(userId, newInterval);
        }
    },
};
module.exports.userJoinTimestamps = userJoinTimestamps;