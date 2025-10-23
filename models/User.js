const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    discordId: {
        type: String,
        required: true,
        unique: true,
    },
    xp: {
        type: Number,
        default: 0,
    },
    level: {
        type: Number,
        default: 1,
    },
});

const User = mongoose.model('User', userSchema);

module.exports = User;