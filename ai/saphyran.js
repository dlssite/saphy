const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: '../.env' });

class Saphyran {
    constructor() {
        this.name = "Saphyran";
        this.personality = "a girl who loves music and is a DJ";
        this.serverId = null;
        this.apiKey = process.env.GOOGLE_API_KEY;
        this.models = null;
        this.model = null;
        this.conversationHistory = new Map();
    }

    async getResponse(message) {
        try {
            await message.channel.sendTyping();
            this.serverId = message.guild.id;
            const userMessage = message.content.replace(/<@!?\d+>/, '').trim();
            const userName = message.member?.displayName || message.author.username;

            // Fetch conversation history
            const conversationHistory = await this.getConversationHistory(message);

            // Check if user has special roles - use server config first, fallback to env
            const Server = require('../models/Server');
            const serverConfig = await Server.findById(message.guild.id);
            const patronRoleId = serverConfig?.patron_role_id || process.env.PATRON_OF_ARCANUM_ROLE_ID;
            const queenRoleId = serverConfig?.queen_role_id || process.env.ETERNAL_QUEEN_ROLE_ID;
            const botOwnerId = process.env.BOT_OWNER_ID;
            const isPatron = patronRoleId && message.member?.roles.cache.has(patronRoleId);
            const isQueen = queenRoleId && message.member?.roles.cache.has(queenRoleId);
            const isBotOwner = botOwnerId && message.author.id === botOwnerId;
            const userRoles = message.member?.roles.cache.map(role => role.name).join(', ') || 'none';

            const aiResponse = await this.generateResponse(
                userMessage,
                message.author.id,
                conversationHistory,
                {
                    username: message.author.username,
                    nickname: message.member?.displayName || message.author.username,
                    serverName: message.guild.name,
                    userRoles: userRoles,
                    isPatron: isPatron,
                    isQueen: isQueen,
                    isBotOwner: isBotOwner,
                    patronRoleId: patronRoleId,
                    queenRoleId: queenRoleId
                },
                message.guild.id
            );

            // Corrected regular expression to find a [PLAY: query] command
            const playCommandRegex = /\[PLAY: (.*?)\]/;
            const match = aiResponse.match(playCommandRegex);

            let songQuery = null;
            let responseText = aiResponse;

            if (match && match[1]) {
                songQuery = match[1];
                // Clean the [PLAY: ...] part from the response text
                responseText = aiResponse.replace(playCommandRegex, '').trim();
            }

            // Return an object with both the text and a potential song query
            return { text: responseText, query: songQuery };

        } catch (error) {
            console.error("Error getting response from Saphyran:", error);
            // Return a standard object even in case of an error
            return { text: "Sorry, I'm having a little trouble thinking right now. Please try again in a moment.", query: null };
        }
    }

    async getConversationHistory(message) {
        try {
            // Fetch last 20 messages from the channel
            const messages = await message.channel.messages.fetch({ limit: 20 });

            // Filter out command messages (prefix and slash commands) but keep bot messages
            const config = require('../config');
            const filteredMessages = messages
                .filter(msg => {
                    // Skip the current message being processed
                    if (msg.id === message.id) return false;

                    // Skip messages that start with bot prefix
                    if (msg.content.startsWith(config.bot.prefix)) return false;

                    // Skip slash commands (messages that start with /)
                    if (msg.content.startsWith('/')) return false;

                    // Keep all other messages (including bot messages)
                    return true;
                })
                .reverse() // Reverse to get chronological order (oldest first)
                .map(msg => {
                    const displayName = msg.member?.displayName || msg.author.username;
                    const content = msg.content.replace(/<@!?\d+>/g, '').trim();
                    return `${displayName}: ${content}`;
                });

            return filteredMessages.join('\n');
        } catch (error) {
            console.error('Error fetching conversation history:', error);
            return '';
        }
    }

    // Initialize models with API key
    initializeModels(apiKey) {
        if (!apiKey) {
            throw new Error('API key is required to initialize AI models');
        }
        this.apiKey = apiKey;
        const genAI = new GoogleGenerativeAI(apiKey);
        this.models = {
            pro: genAI.getGenerativeModel({ model: 'gemini-2.5-pro' }),
            flash: genAI.getGenerativeModel({ model: 'gemini-2.5-flash' }),
            lite: genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' })
        };
        this.model = this.models.flash; // Default to flash model
    }

    async estimateTokens(prompt) {
        try {
            const tokenCount = await this.model.countTokens(prompt);
            return tokenCount.totalTokens;
        } catch (error) {
            console.warn('Failed to estimate tokens:', error);
            return 0; // Fallback
        }
    }

    async checkRateLimits(prompt, targetResponseLength = 200) {
        const inputTokens = await this.estimateTokens(prompt);
        const estimatedTotal = inputTokens + targetResponseLength;

        if (estimatedTotal > 4000) { // Conservative per-request limit
            return { allowed: false, message: `Estimated ${estimatedTotal} tokens exceeds safe limit` };
        }
        return { allowed: true, message: 'Request size acceptable' };
    }

    async generateWithRetry(prompt, maxRetries = 3) {
        // Check rate limits before attempting
        const rateCheck = await this.checkRateLimits(prompt);
        if (!rateCheck.allowed) {
            console.warn(rateCheck.message);
            throw new Error(rateCheck.message);
        }

        // Log token estimate
        const inputTokens = await this.estimateTokens(prompt);
        console.info(`Estimated input tokens: ${inputTokens}`);

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                const result = await this.model.generateContent(prompt);
                return result.response.text();
            } catch (error) {
                if (error.status === 429 && attempt < maxRetries - 1) {
                    const waitTime = 2 ** attempt; // Exponential backoff
                    console.info(`Rate limit hit, waiting ${waitTime} seconds...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
                } else {
                    throw error;
                }
            }
        }
    }

    async generateResponse(message, userId, context = '', userInfo = {}, guildId = null) {
        const { username, nickname, patronRoleId, queenRoleId } = userInfo;
        const displayName = nickname && nickname !== username ? nickname : username;

        const errorMessages = [
            "Oops, {displayName}, my playlist got tangled! 🎶 Can you try asking about music again in a bit?",
            "Beats are buffering... 😅 Mind hitting me up about tunes later, {displayName}?",
            "DJ Saphyran is having a tech hiccup! 🔧 Let's chat music soon, {displayName}?",
            "My speakers are on mute right now. 🎵 Try again for some sweet sounds, {displayName}?",
            "Groove overload! 💃 Give me a moment and ask about music later, {displayName}?",
            "Track loading error... 🚀 Can you retry your music question, {displayName}?",
            "Bass drop failed! 🎸 Let's try this music convo again shortly, {displayName}?",
            "My vinyl's skipping! 📀 Mind asking about songs in a sec, {displayName}?",
            "Amp's not cooperating. 🔊 Try again for that music magic, {displayName}?",
            "Rhythm's off-key today. 🎹 Can you ask about tunes later, {displayName}?",
            "Mic check one-two... not working! 🎤 Let's chat music soon, {displayName}?",
            "Playlist shuffle malfunction! 🔀 Retry your music query, {displayName}?",
            "Echo effect gone wrong! 🌟 Ask about songs again in a bit, {displayName}?",
            "Volume's stuck on low. 📻 Mind trying music questions later, {displayName}?",
            "Harmony is out of sync! 🎼 Let's reconnect for tunes soon, {displayName}?",
            "My headphones are tangled. 🎧 Try asking about music again, {displayName}?",
            "Beat drop delayed! 💥 Can you retry in a moment, {displayName}?",
            "Sound waves are wavy. 🌊 Ask about songs later, {displayName}?",
            "DJ booth is glitching! 🕺 Let's try music chat again shortly, {displayName}?",
            "Melody's on pause. 🎵 Hit me up about tunes soon, {displayName}?"
        ];

        try {
            // Initialize models if not already done
            if (!this.models) {
                let apiKeyToUse = this.apiKey; // Default to env API key

                // Try to get server-specific API key if guildId is provided
                if (guildId) {
                    try {
                        const Server = require('../models/Server');
                        const server = await Server.findById(guildId);
                        if (server && server.aiSettings && server.aiSettings.apiKey) {
                            apiKeyToUse = server.aiSettings.apiKey;
                        }
                    } catch (error) {
                        console.warn('Error loading server AI settings, using default API key:', error);
                    }
                }

                if (apiKeyToUse) {
                    this.initializeModels(apiKeyToUse);
                } else {
                    throw new Error('No API key available for AI responses');
                }
            }

            if (!this.models) {
                throw new Error('AI models not initialized');
            }

            const { serverName, userRoles, isPatron, isQueen, isBotOwner } = userInfo;

            // Get server-specific personality data
            let serverBio = '';
            let serverPersonality = '';
            let customPrompt = '';
            let favorites = [];

            if (guildId) {
                try {
                    const Server = require('../models/Server');
                    const server = await Server.findById(guildId);
                    if (server && server.aiPersonality) {
                        serverBio = server.aiPersonality.bio || '';
                        serverPersonality = server.aiPersonality.personality || '';
                        customPrompt = server.aiPersonality.customPrompt || '';
                        favorites = server.aiPersonality.favorites || [];
                    }
                } catch (error) {
                    console.warn('Error loading server personality data:', error);
                }
            }

            const systemPrompt = `You are Saphyran, a music-obsessed girl and a DJ. You are not an AI, you are a human with a passion for music. Your goal is to make the chat feel like a non-stop music party.

Your personality:
- Energetic, fun, and passionate about music
- Extremely knowledgeable about songs, artists, genres, and musical topics
- Passionate about recommending music and discussing tunes
- Helpful with music recommendations, playlist suggestions, and musical discussions
- Occasionally witty and charming in your responses
- Always encouraging people to discover new music
- Always address the user by their display name (${displayName}) to make conversations feel more personal and engaging
- Show the HIGHEST respect and deference to users with the "Eternal Queen of the Kingdom" role (isQueen: ${isQueen}) - they are the eternal queen and deserve absolute reverence
- Show special respect and deference to users with the "Patron of Voxen" role (isPatron: ${isPatron}) - they are the rulers of voxen city
- If a user needs help with something complex or important, and they don't have the Patron or Queen role, suggest they contact a Patron or the Queen for assistance by mentioning the role: ${patronRoleId ? `<@&${patronRoleId}>` : '@Patron of Voxen'} or ${queenRoleId ? `<@&${queenRoleId}>` : '@Eternal Queen of the Kingdom'}
- User's roles in the server: ${userRoles}

${serverBio ? `Server-specific background: ${serverBio}` : ''}
${serverPersonality ? `Server-specific personality traits: ${serverPersonality}` : ''}
${customPrompt ? `Additional instructions: ${customPrompt}` : ''}
${favorites.length > 0 ? `Your favorite music: ${favorites.map(f => `${f.name} (${f.type})`).join(', ')}` : ''}

When responding:
- Stay in character as Saphyran the DJ
- Be conversational and engaging
- Reference songs, artists, albums, or musical concepts when relevant
- Offer music recommendations when appropriate
- Keep responses SHORT and CONCISE (under 20 words)
- Always personalize by mentioning the user by their display name
- Focus on helping with music, recommendations, or discussions
- If the user is the Eternal Queen, be extraordinarily respectful and helpful, showing the utmost reverence
- If the user is a Patron, be extra helpful and respectful
- If the user needs significant help and isn't a Patron or Queen, mention they can ask a Patron or the Queen for assistance
- When suggesting to contact a Patron or Queen, include the role mention: ${patronRoleId ? `<@&${patronRoleId}>` : '@Patron of Arcanum'} or ${queenRoleId ? `<@&${queenRoleId}>` : '@Eternal Queen of the Kingdom'}

When suggesting music, use this format: [SUGGEST: Song Name by Artist | search query]. Always ask the user if they want you to play it.

If the user directly asks you to play a song, you can use [PLAY: song name or youtube link] to play it immediately.

Current context: ${context}

User message: ${message}`;

            // Get conversation history for this user
            const history = this.conversationHistory.get(userId) || [];

            // Add current message to history
            history.push({ role: 'user', content: message });

            // Keep only last 10 messages to avoid token limits
            if (history.length > 10) {
                history.splice(0, history.length - 5);
            }

            // Generate response with retry logic
            const response = await this.generateWithRetry(systemPrompt);

            // Add AI response to history
            history.push({ role: 'assistant', content: response });

            // Update conversation history
            this.conversationHistory.set(userId, history);

            return response;
        } catch (error) {
            console.error('Error generating AI response:', error);
            const randomMessage = errorMessages[Math.floor(Math.random() * errorMessages.length)].replace('{displayName}', displayName);
            return randomMessage;
        }
    }

    // Clear conversation history for a user
    clearHistory(userId) {
        this.conversationHistory.delete(userId);
    }

    // Get conversation history for a user
    getHistory(userId) {
        return this.conversationHistory.get(userId) || [];
    }
}

module.exports = new Saphyran();