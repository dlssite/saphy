const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Server = require('../../models/Server');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-ai-config')
        .setDescription('Setup AI configuration including roles, API key, and personality')
        .setDefaultMemberPermissions(0x0000000000000008) // Administrator permission
        .addStringOption(option =>
            option.setName('api_key')
                .setDescription('Google API Key for AI')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('model')
                .setDescription('AI Model to use')
                .setRequired(false)
                .addChoices(
                    { name: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash' },
                    { name: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro' },
                    { name: 'Gemini 2.5 Flash Lite', value: 'gemini-2.5-flash-lite' }
                ))
        .addRoleOption(option =>
            option.setName('patron_role')
                .setDescription('Role ID for Patron of Arcanum')
                .setRequired(false))
        .addRoleOption(option =>
            option.setName('queen_role')
                .setDescription('Role ID for Eternal Queen of the Kingdom')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('bio')
                .setDescription('AI character background')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('personality')
                .setDescription('AI character personality traits')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('custom_prompt')
                .setDescription('Additional custom instructions for the AI')
                .setRequired(false)),

    execute: async (interaction, client) => {
        await interaction.deferReply({ ephemeral: true });

        try {
            const server = await Server.findById(interaction.guild.id) || new Server({ _id: interaction.guild.id });

            const apiKey = interaction.options.getString('api_key');
            const model = interaction.options.getString('model');
            const patronRole = interaction.options.getRole('patron_role')?.id;
            const queenRole = interaction.options.getRole('queen_role')?.id;
            const bio = interaction.options.getString('bio');
            const personality = interaction.options.getString('personality');
            const customPrompt = interaction.options.getString('custom_prompt');

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
            console.error('Setup AI Config command error:', error);
            const embed = new EmbedBuilder()
                .setDescription('❌ An error occurred while setting up AI configuration!')
                .setColor('#FF0000');
            await interaction.editReply({ embeds: [embed] });
        }
    }
};
