const { ActivityType } = require('discord.js');

class StatusManager {
    constructor(client) {
        this.client = client;
        this.currentInterval = null;
        this.statusRotationInterval = null;
        this.isPlaying = false;
        this.voiceChannelData = new Map();
        this.currentStatusIndex = 0;
        this.musicStatusIndex = 0;
        this.lastMusicUpdate = Date.now();

        // Enhanced status messages with variety
        this.defaultStatuses = [
            { name: '🎵 Ready for music!', type: ActivityType.Watching },
            { name: '🎸 Grooving to beats', type: ActivityType.Playing },
            { name: '🎧 Listening to requests', type: ActivityType.Listening },
            { name: '🎼 Music in multiple servers', type: ActivityType.Playing },
            { name: '🎤 High-quality audio', type: ActivityType.Streaming },
            { name: '🎶 Your personal DJ', type: ActivityType.Playing },
            { name: '🔊 Crystal clear sound', type: ActivityType.Listening },
            { name: '🎵 /play to start', type: ActivityType.Watching }
        ];

        // Dynamic music status formats
        this.musicStatusFormats = [
            '🎵 {title}',
            '🎶 {title} by {author}',
            '🎸 Playing: {title}',
            '🎧 {title} [{duration}]',
            '🎼 Now: {title}',
            '🎵 {author} - {title}',
            '🎶 Listening to {title}',
            '🎸 {title} 🎸'
        ];
    }


    async updateStatusAndVoice(guildId) {
        try {

            const playerInfo = this.client.playerHandler.getPlayerInfo(guildId);

            if (playerInfo && playerInfo.playing) {

                await this.setPlayingStatus(playerInfo.title, playerInfo.author, playerInfo.duration);
                await this.setVoiceChannelStatus(guildId, playerInfo.title);
            } else {

                await this.setDefaultStatus();
                await this.clearVoiceChannelStatus(guildId);
            }
        } catch (error) {
            console.error('❌ Error updating status and voice channel:', error);
        }
    }


    async setPlayingStatus(trackTitle, author = '', duration = 0) {
        this.stopCurrentStatus();
        this.isPlaying = true;
        this.lastMusicUpdate = Date.now();

        // Format duration
        const formatDuration = (ms) => {
            const seconds = Math.floor(ms / 1000);
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;
            return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
        };

        const formattedDuration = duration > 0 ? formatDuration(duration) : '';

        // Get rotating music status format
        const format = this.musicStatusFormats[this.musicStatusIndex % this.musicStatusFormats.length];
        this.musicStatusIndex++;

        // Replace placeholders
        let activity = format
            .replace('{title}', trackTitle || 'Unknown Track')
            .replace('{author}', author || 'Unknown Artist')
            .replace('{duration}', formattedDuration);

        // Ensure activity doesn't exceed Discord's 128 character limit
        if (activity.length > 128) {
            activity = activity.substring(0, 125) + '...';
        }

        await this.client.user.setPresence({
            activities: [{
                name: activity,
                type: ActivityType.Listening
            }],
            status: 'online'
        });

        // Dynamic status rotation while playing
        this.currentInterval = setInterval(async () => {
            if (this.isPlaying) {
                // Rotate music status format every 45 seconds
                if (Date.now() - this.lastMusicUpdate > 45000) {
                    const newFormat = this.musicStatusFormats[this.musicStatusIndex % this.musicStatusFormats.length];
                    this.musicStatusIndex++;

                    let newActivity = newFormat
                        .replace('{title}', trackTitle || 'Unknown Track')
                        .replace('{author}', author || 'Unknown Artist')
                        .replace('{duration}', formattedDuration);

                    if (newActivity.length > 128) {
                        newActivity = newActivity.substring(0, 125) + '...';
                    }

                    await this.client.user.setPresence({
                        activities: [{
                            name: newActivity,
                            type: ActivityType.Listening
                        }],
                        status: 'online'
                    });

                    activity = newActivity;
                    this.lastMusicUpdate = Date.now();
                    console.log(`🔄 Music status rotated: ${activity}`);
                } else {
                    // Just refresh current status
                    await this.client.user.setPresence({
                        activities: [{
                            name: activity,
                            type: ActivityType.Listening
                        }],
                        status: 'online'
                    });
                }
            }
        }, 30000);

        console.log(`✅ Music status set: ${activity}`);
    }


    async setVoiceChannelStatus(guildId, trackTitle) {
        try {
            const player = this.client.riffy.players.get(guildId);
            if (!player || !player.voiceChannel) return;

            const guild = this.client.guilds.cache.get(guildId);
            if (!guild) return;

            const voiceChannel = guild.channels.cache.get(player.voiceChannel);
            if (!voiceChannel) return;

        
            if (!this.voiceChannelData.has(voiceChannel.id)) {
                this.voiceChannelData.set(voiceChannel.id, {
                    originalName: voiceChannel.name,
                    originalTopic: voiceChannel.topic
                });
            }

    
            const botMember = guild.members.me;
            const permissions = voiceChannel.permissionsFor(botMember);
            
            if (!permissions?.has('ManageChannels')) {
                console.warn(`⚠️ Bot lacks 'Manage Channels' permission in ${voiceChannel.name}`);
                return;
            }

            const statusText = `🎵 ${trackTitle}`;

        
            let success = await this.createVoiceStatusAPI(voiceChannel.id, statusText);
            if (success) return;

            success = await this.createChannelTopic(voiceChannel, trackTitle);
            if (success) return;

            await this.createChannelName(voiceChannel, trackTitle);

        } catch (error) {
            console.error(`❌ Voice channel status creation failed: ${error.message}`);
        }
    }


    async clearVoiceChannelStatus(guildId) {
        try {
            const guild = this.client.guilds.cache.get(guildId);
            if (!guild) return;

       
            const botMember = guild.members.me;
            let voiceChannel = null;

    
            const player = this.client.riffy.players.get(guildId);
            if (player && player.voiceChannel) {
                voiceChannel = guild.channels.cache.get(player.voiceChannel);
            }

   
            if (!voiceChannel && botMember.voice.channelId) {
                voiceChannel = guild.channels.cache.get(botMember.voice.channelId);
            }

 
            if (!voiceChannel) {
                for (const channel of guild.channels.cache.values()) {
                    if (channel.type === 2 && this.voiceChannelData.has(channel.id)) { // Voice channel
                        voiceChannel = channel;
                        break;
                    }
                }
            }

            if (!voiceChannel) return;

    
            const permissions = voiceChannel.permissionsFor(botMember);
            if (!permissions?.has('ManageChannels')) {
                console.warn(`⚠️ Bot lacks 'Manage Channels' permission in ${voiceChannel.name}`);
                return;
            }

        
            let success = await this.deleteVoiceStatusAPI(voiceChannel.id);
            if (success) return;

            success = await this.deleteChannelTopic(voiceChannel);
            if (success) return;

            await this.deleteChannelName(voiceChannel);

        } catch (error) {
            console.error(`❌ Voice channel status clearing failed: ${error.message}`);
        }
    }

   
    async createVoiceStatusAPI(channelId, statusText) {
        try {
            await this.client.rest.put(`/channels/${channelId}/voice-status`, {
                body: { status: statusText }
            });
            console.log(`✅ Voice status created: ${statusText}`);
            return true;
        } catch (error) {
            console.log(`ℹ️ Voice status API not available for creation`);
            return false;
        }
    }


    async deleteVoiceStatusAPI(channelId) {
        try {
            
            await this.client.rest.put(`/channels/${channelId}/voice-status`, {
                body: { status: null }
            });
            console.log(`✅ Voice status cleared`);
            return true;
        } catch (error) {
            try {
             
                await this.client.rest.delete(`/channels/${channelId}/voice-status`);
                console.log(`✅ Voice status deleted`);
                return true;
            } catch (deleteError) {
                console.log(`ℹ️ Voice status API not available for deletion`);
                return false;
            }
        }
    }


    async createChannelTopic(voiceChannel, trackTitle) {
        try {
            const topicText = `🎵 Now Playing: ${trackTitle}`;
            await voiceChannel.setTopic(topicText);
            console.log(`✅ Voice channel topic created: ${topicText}`);
            return true;
        } catch (error) {
            console.log(`ℹ️ Channel topic creation failed: ${error.message}`);
            return false;
        }
    }


    async deleteChannelTopic(voiceChannel) {
        try {
            const originalData = this.voiceChannelData.get(voiceChannel.id);
            const originalTopic = originalData?.originalTopic || null;
            
            await voiceChannel.setTopic(originalTopic);
            console.log(`✅ Voice channel topic restored`);
            return true;
        } catch (error) {
            console.log(`ℹ️ Channel topic restoration failed: ${error.message}`);
            return false;
        }
    }


    async createChannelName(voiceChannel, trackTitle) {
        try {
            const originalData = this.voiceChannelData.get(voiceChannel.id);
            const baseName = originalData?.originalName || voiceChannel.name.replace(/🎵.*$/, '').trim();
            
            const shortTitle = trackTitle.length > 15 
                ? trackTitle.substring(0, 15) + '...' 
                : trackTitle;
            const newName = `🎵 ${baseName}`;

            if (newName !== voiceChannel.name && newName.length <= 100) {
                await voiceChannel.setName(newName);
                console.log(`✅ Voice channel name created: ${newName}`);
            }
            return true;
        } catch (error) {
            console.warn(`⚠️ Channel name creation failed: ${error.message}`);
            return false;
        }
    }

   
    async deleteChannelName(voiceChannel) {
        try {
            const originalData = this.voiceChannelData.get(voiceChannel.id);
            const originalName = originalData?.originalName;
            
            if (originalName && originalName !== voiceChannel.name) {
                await voiceChannel.setName(originalName);
                console.log(`✅ Voice channel name restored: ${originalName}`);
                
         
                this.voiceChannelData.delete(voiceChannel.id);
            }
            return true;
        } catch (error) {
            console.warn(`⚠️ Channel name restoration failed: ${error.message}`);
            return false;
        }
    }


    async setDefaultStatus() {
        this.stopCurrentStatus();
        this.isPlaying = false;

        // Start rotating default statuses
        this.startStatusRotation();

        console.log(`✅ Status rotation started`);
    }

    async startStatusRotation() {
        if (this.statusRotationInterval) {
            clearInterval(this.statusRotationInterval);
        }

        const rotateStatus = async () => {
            if (this.isPlaying) return; // Don't rotate if playing music

            const status = this.defaultStatuses[this.currentStatusIndex % this.defaultStatuses.length];
            this.currentStatusIndex++;

            await this.client.user.setPresence({
                activities: [{
                    name: status.name,
                    type: status.type
                }],
                status: 'online'
            });

            console.log(`🔄 Default status rotated: ${status.name}`);
        };

        // Initial status
        await rotateStatus();

        // Rotate every 2 minutes
        this.statusRotationInterval = setInterval(rotateStatus, 120000);
    }

  
    stopCurrentStatus() {
        if (this.currentInterval) {
            clearInterval(this.currentInterval);
            this.currentInterval = null;
        }
        if (this.statusRotationInterval) {
            clearInterval(this.statusRotationInterval);
            this.statusRotationInterval = null;
        }
    }

 
    async setServerCountStatus(serverCount) {
        if (!this.isPlaying) {
            await this.client.user.setPresence({
                activities: [{
                    name: `🎸 Music in ${serverCount} servers`,
                    type: ActivityType.Playing
                }],
                status: 'online'
            });
            //console.log(`✅ Server count status set: ${serverCount} servers`);
        }
    }


    async onTrackStart(guildId) {
        await this.updateStatusAndVoice(guildId);
    }

 
    async onTrackEnd(guildId) {
        setTimeout(async () => {
            await this.updateStatusAndVoice(guildId);
        }, 1000);
    }


    async onPlayerDisconnect(guildId = null) {
        await this.setDefaultStatus();
        
        if (guildId) {
       
            await this.clearVoiceChannelStatus(guildId);
        } else {
     
            for (const guild of this.client.guilds.cache.values()) {
                await this.clearVoiceChannelStatus(guild.id);
            }
        }
    }


    async testVoiceChannelCRUD(guildId, testText = 'Test Song') {
        console.log(`🧪 Testing Voice Channel CRUD for guild ${guildId}`);
        
        const results = [];
        
   
        await this.setVoiceChannelStatus(guildId, testText);
        results.push('✅ CREATE: Status set');
        
        await new Promise(resolve => setTimeout(resolve, 3000)); 
        
     
        const player = this.client.riffy.players.get(guildId);
        if (player?.voiceChannel) {
            const guild = this.client.guilds.cache.get(guildId);
            const voiceChannel = guild?.channels.cache.get(player.voiceChannel);
            if (voiceChannel) {
                results.push(`📖 READ: Channel name: ${voiceChannel.name}`);
                results.push(`📖 READ: Channel topic: ${voiceChannel.topic || 'None'}`);
            }
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000)); 
        
  
        await this.clearVoiceChannelStatus(guildId);
        results.push('🗑️ DELETE: Status cleared');
        
        return results.join('\n');
    }
}

module.exports = StatusManager;
