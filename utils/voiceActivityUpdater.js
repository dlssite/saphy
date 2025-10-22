const User = require('../models/User');
const { calculateXP, calculateLevel } = require('./voiceLeveling');

const updateInterval = 60 * 1000; // Update every 60 seconds

async function startVoiceActivityUpdates(userJoinTimestamps) {
    setInterval(async () => {
        for (const [userId, lastUpdateTime] of userJoinTimestamps.entries()) {
            try {
                const now = Date.now();
                const durationInSeconds = Math.floor((now - lastUpdateTime) / 1000);

                // Only award XP if a significant duration has passed since the last update
                if (durationInSeconds >= 5) { // Update XP at least every 5 seconds
                    const xpGained = calculateXP(durationInSeconds);

                    let user = await User.findOne({ discordId: userId });

                    if (!user) {
                        user = new User({ discordId: userId });
                    } else {
                        if (user.xp === undefined) user.xp = 0;
                        if (user.level === undefined) user.level = 1;
                    }

                    const oldLevel = user.level;
                    user.xp += xpGained;
                    user.level = calculateLevel(user.xp);

                    await user.save();

                    // Update the last update time for this user
                    userJoinTimestamps.set(userId, now);

                    console.log(`Updated voice XP for user ${userId}. Gained ${xpGained} XP. New XP: ${user.xp}, New Level: ${user.level}`);

                    // Optional: Check for level up and notify
                    if (user.level > oldLevel) {
                        // You would need a way to get the guild/member here
                        // This part is more complex as we are not in a voiceStateUpdate context
                        // Consider fetching the member or passing necessary info with join timestamp
                        console.log(`User ${userId} leveled up to ${user.level} (Detected by interval)`);
                        // If you want to send a message here, you'll need access to the client and guild context
                    }
                }

            } catch (error) {
                console.error(`Error during periodic voice activity update for user ${userId}:`, error);
                // Optionally remove the user from the map if an error occurs to prevent continuous errors
                // userJoinTimestamps.delete(userId);
            }
        }
    }, updateInterval);

    console.log(`Started voice activity update interval (${updateInterval / 1000} seconds).`);
}

module.exports = {
    startVoiceActivityUpdates,
};