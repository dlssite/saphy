const mongoose = require('mongoose');

const serverSchema = new mongoose.Schema({
    _id: String,

    centralSetup: {
        enabled: Boolean,
        channelId: String,
        embedId: String,
        vcChannelId: String,
        allowedRoles: [String]
    },

    autoVcSetup: {
        enabled: Boolean,
        categoryId: String,
        namingPattern: String,
        autoDelete: Boolean
    },

    settings: {
        prefix: String,
        autoplay: Boolean,
        defaultVolume: Number,
        djRole: String,
        levelingChannelId: String,
        levelingNotificationImage: String,
        levelingEmbedColor: String,
        levelingMessages: [String],
        levelingXPPerMinute: { type: Number, default: 1 },
        levelingXPPerLevel: { type: Number, default: 100 }
    },

    aiPersonality: {
        bio: String,
        personality: String,
        serverHierarchy: String,
        serverLore: String,
        customPrompt: String,
        favorites: [{
            name: String,
            url: String,
            type: { type: String, enum: ['song', 'playlist'] }
        }]
    },

    aiSettings: {
        apiKey: String,
        model: String
    },

    levelCard: {
        backgroundColor: String,
        accentColor: String,
        textColor: String,
        progressColor: String,
        backgroundImage: String,
        allowedRoles: [String]
    },

    userLevelCards: {
        type: Object,
        default: {}
    },

    ttsSettings: {
        enabled: Boolean,
        apiKey: String,
        model: String,
        voice: String
    },

    lavalinkSettings: {
        host: String,
        port: Number,
        password: String,
        secure: Boolean
    }
});

module.exports = mongoose.model('Server', serverSchema);
