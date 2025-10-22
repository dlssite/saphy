const axios = require('axios');
const fs = require('fs');
const path = require('path');

class TTSManager {
    constructor(client) {
        this.client = client;
        this.availableVoices = [
            'en-US-Neural2-A', 'en-US-Neural2-C', 'en-US-Neural2-D', 'en-US-Neural2-E', 'en-US-Neural2-F', 'en-US-Neural2-G', 'en-US-Neural2-H', 'en-US-Neural2-I', 'en-US-Neural2-J',
            'en-GB-Neural2-A', 'en-GB-Neural2-B', 'en-GB-Neural2-C', 'en-GB-Neural2-D', 'en-GB-Neural2-F',
            'en-AU-Neural2-A', 'en-AU-Neural2-B', 'en-AU-Neural2-C', 'en-AU-Neural2-D'
        ];
        this.defaultVoice = 'en-US-Neural2-A';
        this.tempDir = path.join(__dirname, '..', 'temp');
        this.ensureTempDir();
    }

    ensureTempDir() {
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }

    async generateTTS(text, voice = 'en-US-Neural2-A', model = this.defaultModel, apiKey) {
        try {
            if (!apiKey) {
                throw new Error('Google Cloud API key is required for TTS');
            }

            const response = await axios.post('https://texttospeech.googleapis.com/v1/text:synthesize', {
                input: { text: text },
                voice: { languageCode: 'en-US', name: voice },
                audioConfig: { audioEncoding: 'MP3' }
            }, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                responseType: 'json',
                timeout: 30000
            });

            // Decode base64 audio content
            const audioContent = Buffer.from(response.data.audioContent, 'base64');

            const fileName = `tts_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp3`;
            const filePath = path.join(this.tempDir, fileName);

            fs.writeFileSync(filePath, audioContent);

            return filePath;
        } catch (error) {
            console.error('TTS Generation Error:', error.response?.data || error.message);
            throw new Error(`Failed to generate TTS: ${error.message}`);
        }
    }

    async playTTS(guildId, filePath) {
        try {
            const player = this.client.riffy.players.get(guildId);
            if (!player) {
                throw new Error('No active player found in this guild');
            }

            // Create a track from the TTS file
            const track = {
                title: 'TTS Message',
                author: 'System',
                url: `file://${filePath}`,
                duration: 0, // Will be determined by Riffy
                thumbnail: null,
                requester: { id: 'system', username: 'TTS' }
            };

            // Add to queue or play immediately if queue is empty
            if (player.queue.size === 0 && !player.current) {
                await player.play(track);
            } else {
                player.queue.add(track);
            }

            // Clean up file after a delay
            setTimeout(() => {
                try {
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                    }
                } catch (cleanupError) {
                    console.warn('Failed to cleanup TTS file:', cleanupError.message);
                }
            }, 60000); // Clean up after 1 minute

            return true;
        } catch (error) {
            console.error('TTS Playback Error:', error.message);
            throw error;
        }
    }

    async speakMessage(guildId, text, voice, model, apiKey) {
        try {
            const audioFile = await this.generateTTS(text, voice, model, apiKey);
            await this.playTTS(guildId, audioFile);
            return true;
        } catch (error) {
            console.error('TTS Speak Error:', error.message);
            throw error;
        }
    }

    getAvailableVoices() {
        return this.availableVoices;
    }

    validateVoice(voice) {
        return this.availableVoices.includes(voice);
    }

    validateModel(model) {
        // For Google TTS, we don't use models, but we'll keep this for compatibility
        return true;
    }
}

module.exports = TTSManager;
