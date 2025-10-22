const config = require('../config');
const Server = require('../models/Server');
const { EmbedBuilder } = require('discord.js');

const userCooldowns = new Map();
const SPAM_THRESHOLD = 3;
const COOLDOWN_TIME = 5000;

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

// Cleanup cooldowns periodically
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

module.exports = {
    handleCentralMessage,
    validateCentralVoiceAccess,
    handleCentralSongRequest,
    safeDeleteMessage,
    isSongQuery,
    findCommand
};
