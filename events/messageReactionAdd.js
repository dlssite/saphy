const { Events } = require('discord.js');

module.exports = {
    name: Events.MessageReactionAdd,
    async execute(reaction, user) {
        if (user.bot) return;

        const { message, emoji } = reaction;

        // Check if this is a suggestion message
        if (!message.client.suggestions || !message.client.suggestions.has(message.id)) return;

        const suggestionData = message.client.suggestions.get(message.id);

        // Check if the user is the one who requested the suggestion
        if (suggestionData.userId !== user.id) return;

        // Check if the suggestion has expired
        if (Date.now() > suggestionData.expiresAt) {
            message.client.suggestions.delete(message.id);
            return;
        }

        // Handle the reaction
        if (emoji.name === '✅') {
            // Play the suggested song
            const playCommand = message.client.commands.get('play');
            if (playCommand) {
                // Simulate a message with the search query
                const fakeMessage = {
                    ...message,
                    content: suggestionData.searchQuery,
                    author: user,
                    reply: message.reply.bind(message)
                };
                await playCommand.execute(fakeMessage, [suggestionData.searchQuery], message.client);
            }
        } else if (emoji.name === '❌') {
            // Ignore the suggestion
            await message.reply('Suggestion declined.');
        }

        // Remove the suggestion data after handling
        message.client.suggestions.delete(message.id);
    }
};
