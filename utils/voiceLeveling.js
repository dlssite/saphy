// Assume you have a database connection and a user schema/model available
const User = require('../models/User'); // Your User model with fields like discordId, xp, level

// Function to update user experience based on time spent in voice (Placeholder - requires voice state tracking)
async function updateUserVoiceXP(userId, durationInSeconds) {
  const xpEarned = calculateXP(durationInSeconds); // Implement calculateXP based on your desired rate

  try {
    let user = await User.findOne({ discordId: userId });

    if (!user) {
      // Create new user if not found
      user = new User({
        discordId: userId,
        xp: xpEarned,
        level: 1, // Start at level 1
      });
    } else {
      user.xp += xpEarned;
      const oldLevel = user.level;
      user.level = calculateLevel(user.xp); // Implement calculateLevel

      if (user.level > oldLevel) {
        // User leveled up, send notification
        notifyLevelUp(userId, user.level);
      }
    }

    await user.save();
    return user;

  } catch (error) {
    console.error(`Error updating voice XP for user ${userId}:`, error);
  }
}

// Function to calculate XP based on duration

function calculateXP(durationInSeconds, guildId) {
  // Implement your XP calculation logic here
  // For example, 1 XP per minute:
  const Server = require('../models/Server');
  const server = Server.findOne({ _id: guildId });
  const xpPerMinute = server?.settings?.levelingXPPerMinute || 1;
  return Math.floor(durationInSeconds / 60) * xpPerMinute;
}

// Function to calculate level based on XP

function calculateLevel(xp, guildId) {
  // Implement your level calculation logic here
  // Changed to linear scaling: level up every 100 XP
  const Server = require('../models/Server');
  const server = Server.findOne({ _id: guildId });
  const xpPerLevel = server?.settings?.levelingXPPerLevel || 100;
  return Math.floor(xp / xpPerLevel) + 1;
}

// Function to notify user of level up (implementation depends on your bot framework)
function notifyLevelUp(userId, newLevel) {
  // This is a placeholder. You would use your bot's client to send a message to the user
  // For example, using discord.js:
  // client.users.cache.get(userId).send(`Congratulations! You've reached level ${newLevel}!`);
  console.log(`User ${userId} leveled up to ${newLevel}!`);
}

// Function to create a level-up embed
async function createLevelUpEmbed(member, newLevel, guildId) {
  const { EmbedBuilder } = require('discord.js');
  const Server = require('../models/Server');

  const server = await Server.findOne({ _id: guildId });
  const embedColor = server?.settings?.levelingEmbedColor || '#00ff00';
  const notificationImage = server?.settings?.levelingNotificationImage || guild.iconURL({ dynamic: true, size: 512 });
  const defaultMessages = [
    '🎉 Congratulations {user}! You\'ve just leveled up to level **{level}**! Your dedication to voice activity is paying off—keep chatting and climbing the ranks!',
    '🚀 {user} just blasted off to level **{level}**! Keep it up, superstar—you\'re making waves in the server with your awesome presence!',
    '⭐ Amazing job, {user}! You\'ve reached level **{level}**! Your voice is a beacon of energy—shine on and inspire others to join the fun!',
    '🎊 {user} is now level **{level}**! Fantastic job on this milestone—what an incredible journey you\'ve embarked on in our community!',
    '🌟 {user} leveled up to **{level}**! You\'re on fire, and it\'s contagious—keep the momentum going and light up the server even more!'
  ];

  const messages = server?.settings?.levelingMessages && server.settings.levelingMessages.length > 0
    ? server.settings.levelingMessages
    : defaultMessages;

  const randomMessage = messages[Math.floor(Math.random() * messages.length)]
    .replace('{user}', member.user.username)
    .replace('{level}', newLevel);

  const embed = new EmbedBuilder()
    .setColor(embedColor)
    .setDescription(randomMessage)
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
    .setImage(notificationImage)
    .setTimestamp();

  return embed;
}

// --- Example Usage in a Discord Bot Context ---

// You would need to integrate this system into your bot's event handlers.
// For example, in your 'voiceStateUpdate' event:

/*
client.on('voiceStateUpdate', async (oldState, newState) => {
  const userId = oldState.member.id;
  const oldChannel = oldState.channel;
  const newChannel = newState.channel;

  // User joined a voice channel
  if (!oldChannel && newChannel) {
    // Store join time (you'll need a mechanism to track this for each user)
    // Example: using a Map or storing in your user data
    // userVoiceJoinTimes.set(userId, Date.now());
  }

  // User left a voice channel
  if (oldChannel && !newChannel) {
    // Calculate duration and update XP
    // const joinTime = userVoiceJoinTimes.get(userId);
    // if (joinTime) {
    //   const durationInSeconds = (Date.now() - joinTime) / 1000;
    //   await updateUserVoiceXP(userId, durationInSeconds);
    //   userVoiceJoinTimes.delete(userId); // Clean up
    // }
  }

  // User moved to a different channel (optional: track time in old channel before starting in new)
  if (oldChannel && newChannel && oldChannel.id !== newChannel.id) {
     // Similar logic as leaving and joining
  }
});
*/

// Function to get a user's level and XP
async function getUserLevelAndXP(userId, guildId) {
  try {
    // For now, we'll use discordId as the primary key
    const user = await User.findOne({ discordId: userId });

    if (!user) {
      return null; // User not found
    }

    return {
      level: user.level,
      xp: user.xp,
    };
  } catch (error) {
    console.error(`Error getting level and XP for user ${userId}:`, error);
    return null; // Return null on error
  }
}

// Function to get leaderboard data (Placeholder - requires implementation)
async function getLeaderboard(guildId, limit = 10) {
  // Implement logic to fetch and sort users by level/XP for the leaderboard
  try {
    const leaderboard = await User.find().sort({ level: -1, xp: -1 }).limit(limit);
    return leaderboard;
  } catch (error) {
    console.error(`Error fetching leaderboard for guild ${guildId}:`, error);
    return [];
  }
}

module.exports = {
  updateUserVoiceXP,
  getUserLevelAndXP,
  getLeaderboard,
  createLevelUpEmbed,
  calculateXP,
  calculateLevel
};
// Remember to implement the `User` model and integrate the event handling within your bot's main file.