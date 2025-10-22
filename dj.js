
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const ytdl = require('ytdl-core');

class DJ {
    constructor() {
        this.queue = [];
        this.isPlaying = false;
        this.connection = null;
        this.player = createAudioPlayer();

        this.player.on(AudioPlayerStatus.Idle, () => {
            this.isPlaying = false;
            this.playNext();
        });
    }

    async play(interaction, song) {
        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) {
            return interaction.reply('You need to be in a voice channel to play music!');
        }

        if (!this.connection) {
            this.connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: interaction.guild.id,
                adapterCreator: interaction.guild.voiceAdapterCreator,
            });
            this.connection.subscribe(this.player);
        }

        this.queue.push(song);
        if (!this.isPlaying) {
            this.playNext();
        }
    }

    playNext() {
        if (this.queue.length === 0) {
            return;
        }

        this.isPlaying = true;
        const song = this.queue.shift();
        const stream = ytdl(song, { filter: 'audioonly' });
        const resource = createAudioResource(stream);
        this.player.play(resource);
    }
}

module.exports = new DJ();
