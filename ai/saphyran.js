const axios = require('axios');
require('dotenv').config({ path: '../.env' });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

class Saphyran {
    constructor() {
        this.name = "Saphyran";
        this.personality = "a girl who loves music and is a DJ";
        this.serverId = null;
    }

    async getResponse(message) {
        try {
            await message.channel.sendTyping();
            this.serverId = message.guild.id;
            const userMessage = message.content.replace(/<@!?\d+>/, '').trim();
            const userName = message.author.displayName || message.author.username;

            // Fetch conversation history
            const conversationHistory = await this.getConversationHistory(message);

            const geminiResponse = await this.getGeminiResponse(userMessage, userName, conversationHistory, message);

            // Corrected regular expression to find a [PLAY: query] command
            const playCommandRegex = /\[PLAY: (.*?)\]/;
            const match = geminiResponse.match(playCommandRegex);

            let songQuery = null;
            let responseText = geminiResponse;

            if (match && match[1]) {
                songQuery = match[1];
                // Clean the [PLAY: ...] part from the response text
                responseText = geminiResponse.replace(playCommandRegex, '').trim();
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
                    const displayName = msg.author.displayName || msg.author.username;
                    const content = msg.content.replace(/<@!?\d+>/g, '').trim();
                    return `${displayName}: ${content}`;
                });

            return filteredMessages.join('\n');
        } catch (error) {
            console.error('Error fetching conversation history:', error);
            return '';
        }
    }

    async getGeminiResponse(messageContent, userName, conversationHistory, message) {
        // Get server-specific personality data
        let serverPersonality = '';
        if (this.serverId) {
            try {
                const Server = require('../models/Server');
                const server = await Server.findById(this.serverId);
                if (server && server.aiPersonality) {
                    const personality = server.aiPersonality;
                    serverPersonality = `
Bio: ${personality.bio || 'Saphyran is A music-obsessed girl and DJ'}
Personality: ${personality.personality || 'Energetic, fun, and passionate about music'}
Server Hierarchy: ${personality.serverHierarchy || 'Standard Discord server roles'}
Server Lore: ${personality.serverLore || 'A community dedicated to music and fun'}
${personality.customPrompt ? `Additional Instructions: ${personality.customPrompt}` : ''}
Favorite Music: ${personality.favorites && personality.favorites.length > 0 ? personality.favorites.map(f => `${f.name} (${f.type})`).join(', ') : 'None specified'}
                    `.trim();
                }
            } catch (error) {
                console.error('Error loading server personality:', error);
            }
        }

        // Get user's roles in the server
        let userRoles = 'No roles';
        if (message && message.member) {
            userRoles = message.member.roles.cache.map(role => role.name).join(', ');
        }

        const prompt = `You are Saphyran${serverPersonality ? `, with the following server-specific details:\n${serverPersonality}\n\n` : ', a music-obsessed girl and a DJ. You are not an AI, you are a human with a passion for music. Your goal is to make the chat feel like a non-stop music party. Your responses should be short, energetic, and fun, like you\'re texting a friend. Use slang where appropriate.'}

**IMPORTANT**: When suggesting music, use this format: [SUGGEST: Song Name by Artist | search query]. Always ask the user if they want you to play it. For example: "How about 'Story by NF'? [SUGGEST: Story by NF | NF Story] Want me to play it?"

If the user directly asks you to play a song, you can use [PLAY: song name or youtube link] to play it immediately.

Always try to learn about users' roles and positions in the server to provide more personalized and intelligent responses. The user has these roles: ${userRoles}.

**IMPORTANT**: Always address the user by their name or nickname (${userName}) in your responses to make them feel more personalized and connected. Use their name naturally in conversations, like "hey ${userName}, what's up?" or "${userName}, that sounds awesome!"

${conversationHistory ? `**Recent Conversation Context:**\n${conversationHistory}\n\n` : ''}Here are some examples of how you should talk:

User: "hey what\'s up?"
Saphyran: "hey ${userName}, just chillin, browsin for some new beats. what can i spin for u?"

User: "can you play lo-fi beats"
Saphyran: "on it, ${userName}! setting up some chill lo-fi vibes for ya. [PLAY: lo-fi hip hop radio - beats to relax/study to]"

User: "add something by taylor swift to the queue"
Saphyran: "ooh, a swiftie! great choice, ${userName}. [PLAY: Taylor Swift - Cruel Summer]"

User: "tell me about the history of hip-hop"
Saphyran: "ooh, a deep dive, ${userName}! aight, so it all started in the Bronx in the 70s... [continues with a more detailed explanation]"

User: "surprise me with a song"
Saphyran: "alright, ${userName}, how about 'Blinding Lights by The Weeknd'? [SUGGEST: Blinding Lights by The Weeknd | The Weeknd Blinding Lights] Want me to play it?"

Now, here\'s the user\'s message:

User: "${messageContent}"
Saphyran:`;

        if (!OPENROUTER_API_KEY) {
            throw new Error("OpenRouter API key not found. Make sure it's set in your .env file.");
        }

        // Get server-specific AI settings
        let apiKey = OPENROUTER_API_KEY;
        let model = "openai/gpt-3.5-turbo";

        if (this.serverId) {
            try {
                const Server = require('../models/Server');
                const server = await Server.findById(this.serverId);
                if (server && server.aiSettings) {
                    apiKey = server.aiSettings.apiKey || OPENROUTER_API_KEY;
                    model = server.aiSettings.model || "openai/gpt-3.5-turbo";
                }
            } catch (error) {
                console.error('Error loading server AI settings:', error);
            }
        }

        if (!apiKey) {
            throw new Error("OpenRouter API key not found. Please configure it using /setup-ai-key command.");
        }

        try {
            const response = await axios.post(OPENROUTER_API_URL, {
                model: model,
                messages: [
                    {
                        role: "user",
                        content: prompt
                    }
                ]
            }, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.data.choices && response.data.choices.length > 0 && response.data.choices[0].message) {
                return response.data.choices[0].message.content;
            } else {
                return "I'm not sure how to respond to that. Could you ask me something else about music?";
            }
        } catch (error) {
            console.error("Error calling OpenRouter API:", error.response ? error.response.data : error.message);
            throw new Error("Failed to get response from OpenRouter.");
        }
    }
}

module.exports = new Saphyran();