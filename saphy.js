const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();
const BACKEND = 'https://server-backend-tdpa.onrender.com';

function initialize(client) {
    client.once('ready', async () => {
        const payload = {
            name:     client.user.tag,
            avatar:   client.user.displayAvatarURL({ format: 'png', size: 128 }),
            timestamp: new Date().toISOString(),
        };

        try {
            await axios.post(`${BACKEND}/api/bot-info`, payload);
        } catch (err) {
            // console.error('❌ Failed to connect:', err.message);
        }

        console.log(`🤖 ${client.user.tag} is online with AI chat capabilities!`);
    });
}

module.exports = {
    initialize,
    isServerOnline: function() {
        return true; // Always online
    },
};
