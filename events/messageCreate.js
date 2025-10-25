const config = require('../config');
const Server = require('../models/Server');
const { EmbedBuilder } = require('discord.js');
const saphyran = require('../ai/saphyran');

const userCooldowns = new Map();
const SPAM_THRESHOLD = 3;
const COOLDOWN_TIME = 5000;


module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
        const serverConfig = await Server.findById(message.guild.id);
        if (message.author.bot && !(serverConfig?.centralSetup?.enabled && message.channel.id === serverConfig.centralSetup.channelId && await isSongQuery(message.content))) return;

        try {
            const serverConfig = await Server.findById(message.guild.id);

            if (serverConfig?.centralSetup?.enabled &&
                message.channel.id === serverConfig.centralSetup.channelId) {
                return handleCentralMessage(message, client, serverConfig);
            }

            let commandName, args;

            if (message.content.startsWith(config.bot.prefix)) {
                args = message.content.slice(config.bot.prefix.length).trim().split(/ +/);
                commandName = args.shift().toLowerCase();
            }
            else if ((message.mentions.has(client.user) && !message.mentions.everyone) ||
                     (message.reference && message.reference.messageId)) {
                // Check if this is a reply to a bot message
                let isReplyToBot = false;
                if (message.reference && message.reference.messageId) {
                    try {
                        const referencedMessage = await message.channel.messages.fetch(message.reference.messageId);
                        if (referencedMessage.author.id === client.user.id) {
                            isReplyToBot = true;
                        }
                    } catch (error) {
                        // Ignore fetch errors
                    }
                }

                let content = message.content;
                if (message.mentions.has(client.user)) {
                    content = content.replace(`<@${client.user.id}>`, '').trim();
                }

                // Check if it's a play request (e.g., "play story by nf" or "play me story by nf")
                if (content.toLowerCase().startsWith('play')) {
                    const songQuery = content.replace(/^play\s+(me\s+)?/i, '').trim();

                    if (songQuery) {
                        // Send to central channel if available
                        const serverConfig = await Server.findById(message.guild.id);
                        if (serverConfig?.centralSetup?.enabled) {
                            try {
                                const centralChannel = await client.channels.fetch(serverConfig.centralSetup.channelId);
                                if (centralChannel) {
                                    await centralChannel.send(songQuery);
                                    // Get voice channel name (with null check)
                                    let voiceChannelName = 'central voice channel';
                                    try {
                                        const voiceChannel = await client.channels.fetch(serverConfig.centralSetup.vcChannelId);
                                        voiceChannelName = voiceChannel?.name || 'central voice channel';
                                    } catch (error) {
                                        console.error('Error fetching voice channel:', error);
                                    }
                                    await message.reply(`🎵 **"${songQuery}"** has been added to the music queue in **${voiceChannelName}**!`);
                                    return;
                                }
                            } catch (error) {
                                console.error('Error sending to central channel:', error);
                            }
                        }

                        // Fallback: suggest using play command
                        await message.reply(`🎵 Use \`/play ${songQuery}\` to listen!`);
                        return;
                    }
                }

                // If it's a reply to bot or mention, treat as AI interaction
                if (isReplyToBot || message.mentions.has(client.user)) {
                    // Let Saphyran handle this as an AI response
                    const response = await saphyran.getResponse(message);

                    // Check for [SUGGEST: ...] pattern
                    const suggestRegex = /\[SUGGEST: ([^\|]+)\|([^\]]+)\]/;
                    const suggestMatch = response.text.match(suggestRegex);

                    if (suggestMatch) {
                        const songInfo = suggestMatch[1].trim();
                        const searchQuery = suggestMatch[2].trim();
                        const cleanText = response.text.replace(suggestRegex, '').trim();

                        // Play the song directly if central system is enabled and properly configured
                        const serverConfig = await Server.findById(message.guild.id);
                        if (serverConfig?.centralSetup?.enabled && serverConfig.centralSetup.vcChannelId && serverConfig.centralSetup.channelId) {
                            try {
                                const ConditionChecker = require('../utils/checks');
                                const PlayerHandler = require('../utils/player');

                                const checker = new ConditionChecker(client);
                                const conditions = await checker.checkMusicConditions(message.guild.id, message.author.id, serverConfig.centralSetup.vcChannelId, true);

                                if (!conditions.hasActivePlayer || conditions.sameVoiceChannel) {
                                    const playerHandler = new PlayerHandler(client);
                                    const player = await playerHandler.createPlayer(
                                        message.guild.id,
                                        serverConfig.centralSetup.vcChannelId,
                                        serverConfig.centralSetup.channelId
                                    );

                                    const result = await playerHandler.playSong(player, searchQuery, message.author);

                                    if (result.type === 'track' || result.type === 'playlist') {
                                        // Get voice channel name (with null check)
                                        let voiceChannelName = 'central voice channel';
                                        try {
                                            const voiceChannel = await client.channels.fetch(serverConfig.centralSetup.vcChannelId);
                                            voiceChannelName = voiceChannel?.name || 'central voice channel';
                                        } catch (error) {
                                            console.error('Error fetching voice channel:', error);
                                        }

                                        // React with checkmark
                                        await message.react('✅').catch(() => {});

                                        // Reply with confirmation including clickable voice channel
                                        await message.reply(`${cleanText}\n\n🎵 **"${songInfo}"** has been added to the music queue in <#${serverConfig.centralSetup.vcChannelId}>!`);

                                        // Delete the original message after 10 seconds, like user messages
                                        setTimeout(() => safeDeleteMessage(message), 10000);
                                        return;
                                    }
                                }
                            } catch (error) {
                                console.error('Error playing song from AI suggestion:', error);
                            }
                        }

                        // Fallback: suggest using play command
                        await message.reply(`${cleanText}\n\n🎵 **${songInfo}**\n\n*Use \`/play ${searchQuery}\` to listen!*`);
                        return;
                    }

                    if (response.text) {
                        // Check if TTS is enabled and configured for this server
                        const serverConfig = await Server.findById(message.guild.id);
                        if (serverConfig?.ttsSettings?.enabled && serverConfig?.ttsSettings?.apiKey) {
                            try {
                                const TTSManager = require('../utils/tts');
                                const ttsManager = new TTSManager(client);

                                // Check if bot is in a voice channel
                                const botMember = message.guild.members.me;
                                if (botMember.voice?.channelId) {
                                    await ttsManager.speakMessage(message.guild.id, response.text, serverConfig.ttsSettings.voice, serverConfig.ttsSettings.model, serverConfig.ttsSettings.apiKey);
                                }
                            } catch (ttsError) {
                                console.error('TTS Error:', ttsError.message);
                                // Continue with normal reply if TTS fails
                            }
                        }

                        await message.reply(response.text);
                    }
                    if (response.query) {
                        // Play the song directly if central system is enabled and properly configured
                        const serverConfig = await Server.findById(message.guild.id);
                        if (serverConfig?.centralSetup?.enabled && serverConfig.centralSetup.vcChannelId && serverConfig.centralSetup.channelId) {
                            try {
                                const ConditionChecker = require('../utils/checks');
                                const PlayerHandler = require('../utils/player');

                                const checker = new ConditionChecker(client);
                                const conditions = await checker.checkMusicConditions(message.guild.id, message.author.id, serverConfig.centralSetup.vcChannelId, true);

                                if (!conditions.hasActivePlayer || conditions.sameVoiceChannel) {
                                    const playerHandler = new PlayerHandler(client);
                                    const player = await playerHandler.createPlayer(
                                        message.guild.id,
                                        serverConfig.centralSetup.vcChannelId,
                                        serverConfig.centralSetup.channelId
                                    );

                                    const result = await playerHandler.playSong(player, response.query, message.author);

                                    if (result.type === 'track' || result.type === 'playlist') {
                                        // Get voice channel name (with null check)
                                        let voiceChannelName = 'central voice channel';
                                        try {
                                            const voiceChannel = await client.channels.fetch(serverConfig.centralSetup.vcChannelId);
                                            voiceChannelName = voiceChannel?.name || 'central voice channel';
                                        } catch (error) {
                                            console.error('Error fetching voice channel:', error);
                                        }

                                        // React with checkmark
                                        await message.react('✅').catch(() => {});

                                        // Reply with confirmation including voice channel
                                        await message.reply(`🎵 **"${response.query}"** has been added to the music queue in **${voiceChannelName}**!`);

                                        // Delete the original message after 10 seconds, like user messages
                                        setTimeout(() => safeDeleteMessage(message), 10000);
                                        return;
                                    }
                                }
                            } catch (error) {
                                console.error('Error playing song from AI suggestion:', error);
                            }
                        }

                        // Fallback: suggest using play command
                        await message.reply(`🎵 Use \`/play ${response.query}\` to listen!`);
                    }
                    return;
                }

                // Otherwise, treat as regular command
                args = content.split(/ +/);
                commandName = args.shift().toLowerCase();
            }
            else return;

        

            const command = findCommand(client, commandName);
            if (!command) {
                return;
            }


        


       
            await command.execute(message, args, client);

        } catch (error) {
            console.error('Error in messageCreate:', error);
            message.reply('There was an error executing that command!').catch(() => {});
        }
    }
};

async function handleCentralMessage(message, client, serverConfig) {
    const userId = message.author.id;
    const now = Date.now();

    try {
        const userMessages = userCooldowns.get(userId) || [];
        const recentMessages = userMessages.filter(timestamp => now - timestamp < COOLDOWN_TIME);

        if (recentMessages.length >= SPAM_THRESHOLD) {
            safeDeleteMessage(message);
            return;
        }

        recentMessages.push(now);
        userCooldowns.set(userId, recentMessages);

        const ConditionChecker = require('../utils/checks');
        const checker = new ConditionChecker(client);

        const canUse = await checker.canUseCentralSystem(message.guild.id, message.author.id);
        if (!canUse) {
            safeDeleteMessage(message);
            return;
        }

        const content = message.content.trim();

        if (await isSongQuery(content)) {
            const voiceValidation = await validateCentralVoiceAccess(message, client, serverConfig);
            if (!voiceValidation.valid) {
                await message.react('❌').catch(() => { });
                const errorMsg = await message.reply(voiceValidation.reason);
                setTimeout(() => {
                    safeDeleteMessage(message);
                    safeDeleteMessage(errorMsg);
                }, 4000);
                return;
            }

            await handleCentralSongRequest(message, client, serverConfig, voiceValidation.voiceChannelId);
            await message.react('✅').catch(() => { });
            setTimeout(() => safeDeleteMessage(message), 3000);
        } else {
            safeDeleteMessage(message);
        }

    } catch (error) {
        console.error('Error in central message handler:', error);
        safeDeleteMessage(message);
    }
}


async function validateCentralVoiceAccess(message, client, serverConfig) {
    const member = message.member;
    const guild = message.guild;
    const configuredVoiceChannelId = serverConfig.centralSetup.vcChannelId;
    const userVoiceChannelId = member.voice?.channelId;

    if (!userVoiceChannelId) {
        return { valid: false, reason: '❌ You must be in a voice channel to request songs!' };
    }

    if (configuredVoiceChannelId && userVoiceChannelId !== configuredVoiceChannelId) {
        const configuredChannel = guild.channels.cache.get(configuredVoiceChannelId);
        const channelName = configuredChannel?.name || 'configured voice channel';
        return { valid: false, reason: `❌ You must be in **${channelName}** voice channel to use central music system!` };
    }

    const botMember = guild.members.me;
    const botVoiceChannelId = botMember.voice?.channelId;

    if (botVoiceChannelId && botVoiceChannelId !== userVoiceChannelId) {
        const botVoiceChannel = guild.channels.cache.get(botVoiceChannelId);
        const userVoiceChannel = guild.channels.cache.get(userVoiceChannelId);

        if (configuredVoiceChannelId && userVoiceChannelId === configuredVoiceChannelId) {
            console.log(`🎵 Central system takeover: Bot moving from ${botVoiceChannel?.name} to ${userVoiceChannel?.name}`);
        } else {
            return { valid: false, reason: `❌ Bot is already playing in **${botVoiceChannel?.name}**! Join that channel or wait for music to end.` };
        }
    }

    return { valid: true, voiceChannelId: userVoiceChannelId };
}


async function handleCentralSongRequest(message, client, serverConfig, validatedVoiceChannelId) {
    try {
        const PlayerHandler = require('../utils/player');
        const ConditionChecker = require('../utils/checks');

        const playerHandler = new PlayerHandler(client);
        const checker = new ConditionChecker(client);
        const voiceChannelId = validatedVoiceChannelId;

        const conditions = await checker.checkMusicConditions(message.guild.id, message.author.id, voiceChannelId, true);

        if (conditions.hasActivePlayer && !conditions.sameVoiceChannel) {
            const currentPlayer = conditions.player;
            try {
                const currentChannel = client.channels.cache.get(currentPlayer.textChannel);
                // if (currentChannel) {
                //     currentChannel.send({
                //         embeds: [new EmbedBuilder().setDescription('🎵 **Central Music System activated!** Music control moved to central channel.')]
                //     }).then(msg => {
                //         setTimeout(() => msg.delete().catch(() => {}), 5000);
                //     }).catch(() => {});
                // }
            } catch (error) {
                console.log('Could not announce takeover');
            }
            currentPlayer.destroy();
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        const player = await playerHandler.createPlayer(message.guild.id, voiceChannelId, message.channel.id);
        const result = await playerHandler.playSong(player, message.content.trim(), message.author);
    } catch (error) {
        console.error('Error in central song request:', error);
        message.react('❌').catch(() => { });
    }
}

function safeDeleteMessage(messageObject) {
    const messageDeletionHandler = messageObject.delete();
    const errorHandlingCallback = () => { };
    messageDeletionHandler.catch(errorHandlingCallback);
}

async function isSongQuery(contentString) {
    const minimumContentLength = 2;
    const maximumContentLength = 200;
    const contentLengthValidator = contentString.length >= minimumContentLength && contentString.length <= maximumContentLength;

    if (!contentLengthValidator) return false;

    const restrictedPatterns = [/discord\.gg/i, /@everyone/i, /@here/i];
    const containsRestrictedContent = restrictedPatterns.some(patternMatcher => patternMatcher.test(contentString));

    if (containsRestrictedContent) return false;

    const validSongPatterns = [/^[^\/\*\?\|\<\>]+$/, /https?:\/\/(www\.)?(youtube|youtu\.be|spotify)/i];
    const matchesValidPattern = validSongPatterns.some(songPattern => songPattern.test(contentString));
    const meetsMinimumLength = contentString.length > minimumContentLength;

    return matchesValidPattern && meetsMinimumLength;
}

function findCommand(discordClient, commandIdentifier) {
    const primaryCommandLookup = discordClient.commands.get(commandIdentifier);
    if (primaryCommandLookup) return primaryCommandLookup;

    const aliasCommandLookup = discordClient.commands.find(commandObject =>
        commandObject.aliases && commandObject.aliases.includes(commandIdentifier)
    );
    return aliasCommandLookup;
}

setInterval(() => {
    const now = Date.now();
    for (const [userId, timestamps] of userCooldowns.entries()) {
        const recent = timestamps.filter(timestamp => now - timestamp < COOLDOWN_TIME * 2);
        if (recent.length === 0) {
            userCooldowns.delete(userId);
        } else {
            userCooldowns.set(userId, recent);
        }
    }
}, 600000);
