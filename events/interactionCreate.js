const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        if (interaction.isChatInputCommand()) {
            const command = client.slashCommands.get(interaction.commandName);

            if (!command) {
                return interaction.reply({
                    content: 'This command is not available!',
                    ephemeral: true
                });
            }

            try {
                await command.execute(interaction, client);

            } catch (error) {
                console.error('Error executing slash command:', error);

                const reply = {
                    content: 'There was an error executing this command!',
                    ephemeral: true
                };

                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(reply);
                } else {
                    try {
                        await interaction.reply(reply);
                    } catch (replyError) {
                        console.error('Error sending error reply:', replyError);
                    }
                }
            }
        }
        


        else if (interaction.isModalSubmit()) {
            if (interaction.customId === 'tts_setup_modal') {
                await handleTTSSetupModal(interaction, client);
            } else if (interaction.customId === 'lavalink_setup_modal') {
                await handleLavalinkSetupModal(interaction, client);
            }
        }

        else if (interaction.isStringSelectMenu()) {
            if (interaction.customId === 'tts_voice_select') {
                await handleTTSVoiceSelect(interaction, client);
            } else if (interaction.customId === 'help_category_select') {
                await handleHelpCategorySelect(interaction, client);
            }
        }

        else if (interaction.isButton()) {
            // No button handlers currently needed for help
        }
    }
};

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



async function handleTTSSetupModal(interaction, client) {
    await interaction.deferReply({ ephemeral: true });

    try {
        const Server = require('../models/Server');
        const TTSManager = require('../utils/tts');
        const server = await Server.findById(interaction.guild.id) || new Server({ _id: interaction.guild.id });
        const ttsManager = new TTSManager(client);

        const apiKey = interaction.fields.getTextInputValue('tts_api_key');
        const model = interaction.fields.getTextInputValue('tts_model');
        const voice = interaction.fields.getTextInputValue('tts_voice');

        // Validate inputs
        if (!ttsManager.validateVoice(voice)) {
            const embed = new EmbedBuilder()
                .setTitle('❌ Invalid Voice')
                .setDescription(`Invalid voice selected. Available voices: ${ttsManager.getAvailableVoices().join(', ')}`)
                .setColor('#FF0000');
            return await interaction.editReply({ embeds: [embed] });
        }

        if (!ttsManager.validateModel(model)) {
            const embed = new EmbedBuilder()
                .setTitle('❌ Invalid Model')
                .setDescription('Invalid model. Please use Google TTS models.')
                .setColor('#FF0000');
            return await interaction.editReply({ embeds: [embed] });
        }

        // Test the TTS configuration
        const testEmbed = new EmbedBuilder()
            .setTitle('🔄 Testing TTS Configuration')
            .setDescription('Testing your TTS API key, model, and voice...')
            .setColor('#FFFF00');

        await interaction.editReply({ embeds: [testEmbed] });

        try {
            // Test TTS generation with a short message
            await ttsManager.generateTTS('Hello, this is a test.', voice, model, apiKey);

            // Test successful, save the settings
            server.ttsSettings = {
                enabled: server.ttsSettings?.enabled || false,
                apiKey: apiKey,
                model: model,
                voice: voice
            };

            await server.save();

            const successEmbed = new EmbedBuilder()
                .setTitle('✅ TTS Configuration Updated')
                .setDescription('Your TTS settings have been successfully tested and saved!')
                .setColor('#00FF00')
                .addFields(
                    { name: 'Model', value: model, inline: true },
                    { name: 'Voice', value: voice, inline: true },
                    { name: 'Status', value: '✅ Valid and working', inline: true }
                );

            await interaction.editReply({ embeds: [successEmbed] });

        } catch (testError) {
            console.error('TTS configuration test failed:', testError);

            let errorMessage = '❌ Failed to validate TTS configuration. ';
            if (testError.response) {
                if (testError.response.status === 401) {
                    errorMessage += 'Invalid API key.';
                } else if (testError.response.status === 400) {
                    errorMessage += 'Invalid model, voice, or request format.';
                } else {
                    errorMessage += `API error: ${testError.response.status}`;
                }
            } else if (testError.code === 'ECONNABORTED') {
                errorMessage += 'Request timed out. Please try again.';
            } else {
                errorMessage += 'Please check your API key and settings.';
            }

            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ TTS Configuration Failed')
                .setDescription(errorMessage)
                .setColor('#FF0000');

            await interaction.editReply({ embeds: [errorEmbed] });
        }

    } catch (error) {
        console.error('Error handling TTS setup modal:', error);
        const embed = new EmbedBuilder()
            .setDescription('❌ An error occurred while updating TTS configuration!')
            .setColor('#FF0000');
        await interaction.editReply({ embeds: [embed] });
    }
}

async function handleTTSVoiceSelect(interaction, client) {
    await interaction.deferReply({ ephemeral: true });

    try {
        const Server = require('../models/Server');
        const server = await Server.findById(interaction.guild.id) || new Server({ _id: interaction.guild.id });

        const selectedVoice = interaction.values[0];

        if (!server.ttsSettings?.apiKey) {
            const embed = new EmbedBuilder()
                .setDescription('❌ TTS is not configured yet! Use `/setup-tts` to configure it first.')
                .setColor('#FF0000');
            return await interaction.editReply({ embeds: [embed] });
        }

        server.ttsSettings.voice = selectedVoice;
        await server.save();

        const embed = new EmbedBuilder()
            .setTitle('🎤 TTS Voice Updated')
            .setDescription(`TTS voice has been changed to **${selectedVoice}**.`)
            .setColor('#00FF00');

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Error handling TTS voice select:', error);
        const embed = new EmbedBuilder()
            .setDescription('❌ An error occurred while updating TTS voice!')
            .setColor('#FF0000');
        await interaction.editReply({ embeds: [embed] });
    }
}



async function handleAIFavoritesModal(interaction, client) {
    await interaction.deferReply({ ephemeral: true });

    try {
        const Server = require('../models/Server');
        const server = await Server.findById(interaction.guild.id) || new Server({ _id: interaction.guild.id });

        const favoritesInput = interaction.fields.getTextInputValue('favorites');
        const favorites = [];

        if (favoritesInput.trim()) {
            const lines = favoritesInput.split('\n').filter(line => line.trim());
            for (const line of lines) {
                const parts = line.split('|').map(part => part.trim());
                if (parts.length === 3) {
                    const [name, url, type] = parts;
                    if (type === 'song' || type === 'playlist') {
                        favorites.push({ name, url, type });
                    }
                }
            }
        }

        server.aiPersonality = server.aiPersonality || {};
        server.aiPersonality.favorites = favorites;

        await server.save();

        const favoritesList = favorites.length > 0
            ? favorites.map(f => `${f.name} (${f.type})`).join('\n')
            : 'None';

        const embed = new EmbedBuilder()
            .setTitle('🎵 AI Favorite Music Updated')
            .setDescription('The AI favorite music has been successfully updated for this server!')
            .setColor('#00FF00')
            .addFields(
                { name: 'Favorite Music', value: favoritesList, inline: false }
            );

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Error handling AI favorites modal:', error);
        const embed = new EmbedBuilder()
            .setDescription('❌ An error occurred while updating AI favorite music!')
            .setColor('#FF0000');
        await interaction.editReply({ embeds: [embed] });
    }
}

async function handleHelpCategorySelect(interaction, client) {
    try {
        await interaction.deferUpdate();
        const selectedCategory = interaction.values[0];

        // Load commands again to get fresh data
        const fs = require('fs');
        const path = require('path');

        const msgCommandsPath = path.join(__dirname, '..', 'commands', 'message');
        const msgFiles = fs.readdirSync(msgCommandsPath).filter(file => file.endsWith('.js'));
        const messageCommands = msgFiles.map(file => {
            const cmd = require(path.join(msgCommandsPath, file));
            return {
                name: cmd.name || 'Unknown',
                description: cmd.description || 'No description',
                aliases: cmd.aliases || []
            };
        });

        const slashCommandsPath = path.join(__dirname, '..', 'commands', 'slash');
        const slashFiles = fs.readdirSync(slashCommandsPath).filter(file => file.endsWith('.js'));
        const slashCommands = slashFiles.map(file => {
            const cmd = require(path.join(slashCommandsPath, file));
            return {
                name: cmd.data?.name || 'Unknown',
                description: cmd.data?.description || 'No description'
            };
        });

        // Define categories
        const categories = {
            '🎵 Music': {
                message: messageCommands.filter(cmd =>
                    ['play', 'pause', 'resume', 'stop', 'skip', 'queue', 'nowplaying', 'shuffle', 'loop', 'volume', 'join', 'remove', 'jump', 'move', 'clear'].includes(cmd.name)
                ),
                slash: slashCommands.filter(cmd =>
                    ['play', 'pause', 'resume', 'stop', 'skip', 'queue', 'shuffle', 'loop', 'volume', 'join', 'remove', 'autoplay'].includes(cmd.name)
                )
            },
            '🎤 TTS': {
                message: [],
                slash: slashCommands.filter(cmd =>
                    ['setup-tts', 'select-tts-voice', 'toggle-tts', 'tts-status'].includes(cmd.name)
                )
            },
            '🤖 AI': {
                message: [],
                slash: slashCommands.filter(cmd =>
                    ['setup-ai', 'setup-ai-key', 'setup-ai-favorites'].includes(cmd.name)
                )
            },
            '🏆 Leveling': {
                message: messageCommands.filter(cmd =>
                    ['level', 'leaderboard', 'customize-level-card'].includes(cmd.name)
                ),
                slash: slashCommands.filter(cmd =>
                    ['level', 'leaderboard', 'setup-leveling', 'setup-level-card', 'customize-level-card', 'setup-leveling-customization', 'setup-leveling-image', 'setup-leveling-color', 'setup-leveling-messages'].includes(cmd.name)
                )
            },
            '⚙️ Utility': {
                message: messageCommands.filter(cmd =>
                    ['ping', 'help', 'support'].includes(cmd.name)
                ),
                slash: slashCommands.filter(cmd =>
                    ['clean-up', 'clear', 'setup-central', 'disable-central'].includes(cmd.name)
                )
            }
        };

        const categoryData = categories[selectedCategory];
        if (!categoryData) {
            return await interaction.editReply({
                content: '❌ Category not found!',
                embeds: [],
                components: []
            });
        }

        let description = `**${selectedCategory} Commands**\n\n`;

        // Message commands
        if (categoryData.message.length > 0) {
            description += `**💬 Message Commands:**\n`;
            categoryData.message.forEach(cmd => {
                const config = require('../config');
                const prefix = config.bot.prefix || '!';
                const aliases = cmd.aliases.length > 0 ? ` (${cmd.aliases.join(', ')})` : '';
                description += `• \`${prefix}${cmd.name}${aliases}\` - ${cmd.description}\n`;
            });
            description += '\n';
        }

        // Slash commands
        if (categoryData.slash.length > 0) {
            description += `**⚡ Slash Commands:**\n`;
            categoryData.slash.forEach(cmd => {
                description += `• \`/${cmd.name}\` - ${cmd.description}\n`;
            });
        }

        if (categoryData.message.length === 0 && categoryData.slash.length === 0) {
            description += 'No commands available in this category.';
        }

        // Update the embed with category details but keep the dropdown
        const { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

        const categoryEmbed = new EmbedBuilder()
            .setTitle(`${selectedCategory} - Command Details`)
            .setColor(0x1DB954)
            .setDescription(description)
            .setFooter({ text: 'Saphyran • Select another category to view different commands' })
            .setTimestamp();

        const categorySelect = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('help_category_select')
                    .setPlaceholder('Select a command category')
                    .addOptions([
                        {
                            label: 'Music',
                            description: 'Music playback and control commands',
                            value: '🎵 Music',
                            emoji: '🎵'
                        },
                        {
                            label: 'TTS',
                            description: 'Text-to-speech setup and configuration',
                            value: '🎤 TTS',
                            emoji: '🎤'
                        },
                        {
                            label: 'AI',
                            description: 'AI personality and setup commands',
                            value: '🤖 AI',
                            emoji: '🤖'
                        },
                        {
                            label: 'Leveling',
                            description: 'Level system and leaderboard commands',
                            value: '🏆 Leveling',
                            emoji: '🏆'
                        },
                        {
                            label: 'Utility',
                            description: 'General utility and help commands',
                            value: '⚙️ Utility',
                            emoji: '⚙️'
                        }
                    ])
            );

        const supportButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setLabel('Support Server')
                    .setStyle(ButtonStyle.Link)
                    .setURL('https://discord.gg/sanctyr')
            );

        await interaction.editReply({
            embeds: [categoryEmbed],
            components: [categorySelect, supportButton]
        });

    } catch (error) {
        console.error('Error handling help category select:', error);
        await interaction.editReply({
            content: '❌ An error occurred while loading category commands.',
            embeds: [],
            components: []
        });
    }
}

async function handleAIConfigModal(interaction, client) {
    await interaction.deferReply({ ephemeral: true });

    try {
        const Server = require('../models/Server');
        const server = await Server.findById(interaction.guild.id) || new Server({ _id: interaction.guild.id });

        const apiKey = interaction.fields.getTextInputValue('api_key');
        const model = interaction.fields.getTextInputValue('model');
        const patronRole = interaction.fields.getTextInputValue('patron_role');
        const queenRole = interaction.fields.getTextInputValue('queen_role');
        const bio = interaction.fields.getTextInputValue('bio');
        const personality = interaction.fields.getTextInputValue('personality');
        const customPrompt = interaction.fields.getTextInputValue('custom_prompt');

        // Test API key and model if provided
        if (apiKey && model) {
            const testEmbed = new EmbedBuilder()
                .setTitle('🔄 Testing AI Configuration')
                .setDescription('Testing your Google API key and model configuration...')
                .setColor('#FFFF00');

            await interaction.editReply({ embeds: [testEmbed] });

            try {
                const { GoogleGenerativeAI } = require('@google/generative-ai');
                const genAI = new GoogleGenerativeAI(apiKey);

                const validModels = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash-lite'];
                if (!validModels.includes(model)) {
                    throw new Error(`Invalid model. Supported models: ${validModels.join(', ')}`);
                }

                const testModel = genAI.getGenerativeModel({ model: model });
                const result = await testModel.generateContent('Hello, this is a test message.');
                const response = await result.response;
                const text = response.text();

                if (!text || text.length === 0) {
                    throw new Error('Empty response from AI model');
                }

            } catch (testError) {
                console.error('AI configuration test failed:', testError);

                let errorMessage = '❌ Failed to validate Google API key and model. ';
                if (testError.message.includes('API_KEY_INVALID')) {
                    errorMessage += 'Invalid API key.';
                } else if (testError.message.includes('MODEL_INVALID')) {
                    errorMessage += 'Invalid model selected.';
                } else if (testError.message.includes('Invalid model')) {
                    errorMessage += testError.message;
                } else if (testError.status === 403) {
                    errorMessage += 'API key does not have permission to use this model.';
                } else if (testError.status === 429) {
                    errorMessage += 'Rate limit exceeded. Please try again later.';
                } else {
                    errorMessage += 'Please check your API key and model selection.';
                }

                const errorEmbed = new EmbedBuilder()
                    .setTitle('❌ AI Configuration Failed')
                    .setDescription(errorMessage)
                    .setColor('#FF0000');

                return await interaction.editReply({ embeds: [errorEmbed] });
            }
        }

        // Save all settings
        if (apiKey && model) {
            server.aiSettings = {
                apiKey: apiKey,
                model: model
            };
        }

        if (patronRole) {
            server.patron_role_id = patronRole;
        }

        if (queenRole) {
            server.queen_role_id = queenRole;
        }

        server.aiPersonality = {
            bio: bio || server.aiPersonality?.bio || '',
            personality: personality || server.aiPersonality?.personality || '',
            serverHierarchy: server.aiPersonality?.serverHierarchy || '',
            serverLore: server.aiPersonality?.serverLore || '',
            customPrompt: customPrompt || server.aiPersonality?.customPrompt || '',
            favorites: server.aiPersonality?.favorites || []
        };

        await server.save();

        const successEmbed = new EmbedBuilder()
            .setTitle('✅ AI Configuration Updated')
            .setDescription('Your AI configuration has been successfully updated!')
            .setColor('#00FF00')
            .addFields(
                { name: '🔑 API Settings', value: apiKey ? `✅ Model: ${model}` : '❌ Not updated', inline: false },
                { name: '👑 Role Settings', value: (patronRole || queenRole) ? `${patronRole ? `Patron: <@&${patronRole}>\n` : ''}${queenRole ? `Queen: <@&${queenRole}>` : ''}`.trim() : '❌ Not updated', inline: false },
                { name: '🎭 Personality', value: (bio || personality || customPrompt) ? `${bio ? `Bio: ${bio}\n` : ''}${personality ? `Personality: ${personality}\n` : ''}${customPrompt ? `Custom Prompt: ${customPrompt}` : ''}`.trim() : '❌ Not updated', inline: false }
            );

        await interaction.editReply({ embeds: [successEmbed] });

    } catch (error) {
        console.error('Error handling AI config modal:', error);
        const embed = new EmbedBuilder()
            .setDescription('❌ An error occurred while updating AI configuration!')
            .setColor('#FF0000');
        await interaction.editReply({ embeds: [embed] });
    }
}

async function handleLavalinkSetupModal(interaction, client) {
    await interaction.deferReply({ ephemeral: true });

    try {
        const Server = require('../models/Server');
        const server = await Server.findById(interaction.guild.id) || new Server({ _id: interaction.guild.id });

        const host = interaction.fields.getTextInputValue('lavalink_host');
        const port = parseInt(interaction.fields.getTextInputValue('lavalink_port'));
        const password = interaction.fields.getTextInputValue('lavalink_password');
        const secure = interaction.fields.getTextInputValue('lavalink_secure').toLowerCase() === 'true';

        // Validate inputs
        if (!host || !password) {
            const embed = new EmbedBuilder()
                .setTitle('❌ Invalid Configuration')
                .setDescription('Host and password are required fields.')
                .setColor('#FF0000');
            return await interaction.editReply({ embeds: [embed] });
        }

        if (isNaN(port) || port < 1 || port > 65535) {
            const embed = new EmbedBuilder()
                .setTitle('❌ Invalid Port')
                .setDescription('Port must be a valid number between 1 and 65535.')
                .setColor('#FF0000');
            return await interaction.editReply({ embeds: [embed] });
        }

        // Save the Lavalink settings directly without testing
        server.lavalinkSettings = {
            host: host,
            port: port,
            password: password,
            secure: secure
        };

        await server.save();

        // Update the Lavalink configuration for this guild
        if (client.updateGuildLavalinkConfiguration) {
            await client.updateGuildLavalinkConfiguration(interaction.guild.id);
        }

        const successEmbed = new EmbedBuilder()
            .setTitle('✅ Lavalink Configuration Updated')
            .setDescription('Your Lavalink server settings have been saved!')
            .setColor('#00FF00')
            .addFields(
                { name: 'Host', value: host, inline: true },
                { name: 'Port', value: port.toString(), inline: true },
                { name: 'Secure', value: secure ? 'Yes' : 'No', inline: true }
            );

        await interaction.editReply({ embeds: [successEmbed] });

    } catch (error) {
        console.error('Error handling Lavalink setup modal:', error);
        const embed = new EmbedBuilder()
            .setDescription('❌ An error occurred while updating Lavalink configuration!')
            .setColor('#FF0000');
        await interaction.editReply({ embeds: [embed] });
    }
}
