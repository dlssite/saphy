const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../config');
const Server = require('../models/Server');

class CentralEmbedHandler {
    constructor(client) {
        this.client = client;
    }

    async createCentralEmbed(channelId, guildId) {
        try {
            const channel = await this.client.channels.fetch(channelId);
            
            const embed = new EmbedBuilder()
            .setAuthor({ name: 'Saphyran Music', iconURL: 'https://cdn.discordapp.com/emojis/896724352949706762.gif', url: 'https://discord.gg/sanctyr' })
                .setDescription(
                    '**Welcome to the Saphyran Music Experience!**\n\n' +
                    'Ready to vibe? Just drop a song name or a YouTube link below. I\'ll handle the rest. Let\'s make this channel sound awesome!'
                )
                .setColor(0x9966ff) 
                .addFields(
                    {
                        name: '🎯 Quick Start',
                        value: '• `your favorite song`\n• `a youtube playlist link`\n• Join a voice channel!',
                        inline: true
                    },
                    {
                        name: '🚀 Key Features',
                        value: '• High-Fidelity Audio\n• 24/7 Music Playback\n• Advanced Queue System\n• Customizable Controls',
                        inline: true
                    },
                    {
                        name: '💡 Pro-Tip',
                        value: 'Use the `/help` command to discover all the cool things I can do!',
                        inline: false
                    }
                )
                .setImage('https://i.ibb.co/DDSdKy31/ezgif-8aec7517f2146d.gif')
                .setThumbnail('https://cdn.discordapp.com/attachments/1234567890/1234567890/music_note.gif') // Add a cute music note gif
                .setFooter({ 
                    text: 'Saphyran • Developed By DLS!',
                    iconURL: this.client.user.displayAvatarURL()
                })
                .setTimestamp();
            const message = await channel.send({ embeds: [embed] });
            
       
            await Server.findByIdAndUpdate(guildId, {
                'centralSetup.embedId': message.id,
                'centralSetup.channelId': channelId
            });

            console.log(`✅ Central embed created in ${guildId}`);
            return message;
        } catch (error) {
            console.error('Error creating central embed:', error);
            return null;
        }
    }

    
    async resetAllCentralEmbedsOnStartup() {
        try {
            
         
            const servers = await Server.find({
                'centralSetup.enabled': true,
                'centralSetup.embedId': { $exists: true, $ne: null }
            });

            let resetCount = 0;
            let errorCount = 0;

            for (const serverConfig of servers) {
                try {
               
                    const guild = this.client.guilds.cache.get(serverConfig._id);
                    if (!guild) {
                        console.log(`⚠️ Bot no longer in guild ${serverConfig._id}, cleaning up database...`);
                    
                        await Server.findByIdAndUpdate(serverConfig._id, {
                            'centralSetup.enabled': false,
                            'centralSetup.embedId': null
                        });
                        continue;
                    }

               
                    const channel = await this.client.channels.fetch(serverConfig.centralSetup.channelId).catch(() => null);
                    if (!channel) {
                        console.log(`⚠️ Central channel not found in ${guild.name}, cleaning up...`);
                        await Server.findByIdAndUpdate(serverConfig._id, {
                            'centralSetup.enabled': false,
                            'centralSetup.embedId': null
                        });
                        continue;
                    }

                 
                    const botMember = guild.members.me;
                    if (!channel.permissionsFor(botMember).has(['SendMessages', 'EmbedLinks'])) {
                        console.log(`⚠️ Missing permissions in ${guild.name}, skipping...`);
                        continue;
                    }

                   
                    const message = await channel.messages.fetch(serverConfig.centralSetup.embedId).catch(() => null);
                    if (!message) {
                        console.log(`⚠️ Central embed not found in ${guild.name}, creating new one...`);
                       
                        const newMessage = await this.createCentralEmbed(channel.id, guild.id);
                        if (newMessage) {
                            resetCount++;
                           // console.log(`✅ Created new central embed in ${guild.name}`);
                        }
                        continue;
                    }

              
                    await this.updateCentralEmbed(serverConfig._id, null);
                    resetCount++;
                   // console.log(`✅ Reset central embed in ${guild.name}`);

                    await new Promise(resolve => setTimeout(resolve, 100));

                } catch (error) {
                    errorCount++;
                  //  console.error(`❌ Error resetting embed in guild ${serverConfig._id}:`, error.message);
                    
              
                    if (error.code === 50001 || error.code === 10003 || error.code === 50013) {
                        await Server.findByIdAndUpdate(serverConfig._id, {
                            'centralSetup.enabled': false,
                            'centralSetup.embedId': null
                        });
                    }
                }
            }

            if (resetCount > 0) {
                //console.log(`🎵 Successfully reset ${resetCount} central embeds`);
            }
            if (errorCount > 0) {
               // console.log(`⚠️ ${errorCount} embeds had errors during reset`);
            }
            if (resetCount === 0 && errorCount === 0) {
               // console.log('ℹ️ No central embeds found to reset');
            }

        } catch (error) {
            console.error('❌ Error during central embed auto-reset:', error);
        }
    }
    async updateCentralEmbed(guildId, trackInfo = null) {
        try {
            const serverConfig = await Server.findById(guildId);
            if (!serverConfig?.centralSetup?.embedId) return;

            const channel = await this.client.channels.fetch(serverConfig.centralSetup.channelId);
            const message = await channel.messages.fetch(serverConfig.centralSetup.embedId);
            
            let embed, components = [];
            
            if (trackInfo) {
              
                const statusEmoji = trackInfo.paused ? '⏸️' : '▶️';
                const statusText = trackInfo.paused ? 'Paused' : 'Now Playing';
                const loopEmoji = this.getLoopEmoji(trackInfo.loop);
                
             
                const embedColor = trackInfo.paused ? 0xFFA500 :   0x9966ff;
                
                embed = new EmbedBuilder()
                    .setAuthor({ 
                        name: `${trackInfo.title}`, 
                        iconURL: 'https://cdn.discordapp.com/emojis/896724352949706762.gif',
                        url: 'https://discord.gg/sanctyr' 
                    })
                    .setDescription([
                        `**🎤 Artist:** ${trackInfo.author}`,
                        `**👤 Requested by:** <@${trackInfo.requester.id}>`,
                        '',
                        `⏰ **Duration:** \`${this.formatDuration(trackInfo.duration)}\``,
                        `${loopEmoji} **Loop:** \`${trackInfo.loop || 'Off'}\``,
                        `🔊 **Volume:** \`${trackInfo.volume || 50}%\``,
                        '',
                        '🎶 *Type more song names or youtube link below to keep the party going!*'
                    ].join('\n'))
                    .setColor(embedColor)
                    .setThumbnail(trackInfo.thumbnail || 'https://cdn.discordapp.com/emojis/896724352949706762.gif')
                    .setImage(trackInfo.paused ? null : 'https://i.ibb.co/KzbPV8jd/aaa.gif')
                    .setFooter({ 
                        text: `Saphyran • ${statusText} Developed By DLS`,
                        iconURL: this.client.user.displayAvatarURL()
                    })
                    .setTimestamp();
            
                components = this.createAdvancedControlButtons(trackInfo);
            } else {
           
                embed = new EmbedBuilder()
                .setAuthor({ name: 'Saphyran Music', iconURL: 'https://cdn.discordapp.com/emojis/896724352949706762.gif', url: 'https://discord.gg/sanctyr' })
                .setDescription(
                    '**Welcome to the Saphyran Music Experience!**\n\n' +
                    'Ready to vibe? Just drop a song name or a YouTube link below. I\'ll handle the rest. Let\'s make this channel sound awesome!'
                )
                .setColor(0x9966ff) 
                .addFields(
                    {
                        name: '🎯 Quick Start',
                        value: '• `your favorite song`\n• `a youtube playlist link`\n• Join a voice channel!',
                        inline: true
                    },
                    {
                        name: '🚀 Key Features',
                        value: '• High-Fidelity Audio\n• 24/7 Music Playback\n• Advanced Queue System\n• Customizable Controls',
                        inline: true
                    },
                    {
                        name: '💡 Pro-Tip',
                        value: 'Use the `/help` command to discover all the cool things I can do!',
                        inline: false
                    }
                )
                .setImage('https://i.ibb.co/DDSdKy31/ezgif-8aec7517f2146d.gif')
                .setThumbnail('https://cdn.discordapp.com/attachments/1234567890/1234567890/music_note.gif') // Add a cute music note gif
                .setFooter({ 
                    text: 'Saphyran • Developed By DLS!',
                    iconURL: this.client.user.displayAvatarURL()
                })
                .setTimestamp();

         
                components = [];
            }

            await message.edit({ embeds: [embed], components });

        } catch (error) {
            console.error('Error updating central embed:', error);
        }
    }


    createAdvancedControlButtons(trackInfo) {
        if (!trackInfo) return [];


        const row1 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('music_skip')
                    .setEmoji('⏭️')
                    .setStyle(ButtonStyle.Primary),
                    
                new ButtonBuilder()
                    .setCustomId(trackInfo.paused ? 'music_resume' : 'music_pause')
                    .setEmoji(trackInfo.paused ? '▶️' : '⏸️')
                    .setStyle(ButtonStyle.Success),
                    
                new ButtonBuilder()
                    .setCustomId('music_stop')
                    .setEmoji('🛑')
                    .setStyle(ButtonStyle.Danger),
                    
                    new ButtonBuilder()
                    .setCustomId('music_queue')
                    .setEmoji('📜')
                    .setStyle(ButtonStyle.Success),
                    
                    
                new ButtonBuilder()
                    .setLabel('\u200B\u200BLoop\u200B')
                    .setCustomId('music_loop')
                    .setEmoji(this.getLoopEmoji(trackInfo.loop))
                    .setStyle(ButtonStyle.Primary)
            );


        const row2 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('music_volume_down')
                    .setEmoji('🔉')
                    .setStyle(ButtonStyle.Secondary),
                    
                new ButtonBuilder()
                    .setCustomId('music_volume_up')
                    .setEmoji('🔊')
                    .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                    .setCustomId('music_clear')
                    .setEmoji('🗑️')
                    .setStyle(ButtonStyle.Secondary),

                new ButtonBuilder()
                    .setCustomId('music_shuffle')
                    .setEmoji('🔀')
                    .setStyle(ButtonStyle.Secondary),
                    
                new ButtonBuilder()
                    .setLabel('Support')
                    .setStyle(ButtonStyle.Link)
                    .setURL(config.bot.supportServer)
            );

        return [row1, row2];
    }


    getLoopEmoji(loopMode) {
        switch (loopMode) {
            case 'track': return '🔂';
            case 'queue': return '🔁';
            default: return '⏺️';
        }
    }

    formatDuration(duration) {
        if (!duration) return '0:00';
        
        const minutes = Math.floor(duration / 60000);
        const seconds = Math.floor((duration % 60000) / 1000);
        
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
}

module.exports = CentralEmbedHandler;
