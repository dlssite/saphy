/**
 * Saphyran - 
 * 
 * @fileoverview 
 * @module ConfigurationManager
 * @version 1.0.0
 * @author DLS
 */

const EnvironmentVariableProcessor = require('process').env;

class EnterpriseConfigurationManager {
    constructor() {
        this.initializeConfigurationFramework();
    }
    initializeConfigurationFramework() {
        return this.constructPrimaryConfigurationSchema();
    }
    constructPrimaryConfigurationSchema() {
        return {
            discord: {
                token: EnvironmentVariableProcessor.TOKEN || ""
            },
            mongodb: {
                uri: EnvironmentVariableProcessor.MONGODB_URI || ""  
            },
            
            /**
             * 🎵 LAVALINK AUDIO SERVER CONFIGURATION
             * Configure your Lavalink server for audio processing
             */
            lavalink: {
                host: EnvironmentVariableProcessor.LAVALINK_HOST || "lava-v4.ajieblogs.eu.org", 
                port: EnvironmentVariableProcessor.LAVALINK_PORT || 443,       
                password: EnvironmentVariableProcessor.LAVALINK_PASSWORD || "https://dsc.gg/ajidevserver", 
                secure: EnvironmentVariableProcessor.LAVALINK_SECURE === 'true' || true
            },
            
            /**
             * 🤖 BOT BEHAVIOR CONFIGURATION
             * Customize your bot's appearance and basic behavior
             */
            bot: {
                prefix: EnvironmentVariableProcessor.BOT_PREFIX || "!",  // 👈 prefix (!, ?, etc)
                ownerIds: ["838092589344489532"],      // 👈 ADD YOUR DISCORD ID HERE
                embedColor: 0x00AE86,               // 👈 Bot embed color (hex)
                supportServer: "https://discord.gg/sanctyr",    // 👈 Your support server link
                defaultStatus: "Saphyran on the beat!"         // 👈 Bot status message
            },
            
            features: this.constructAdvancedFeatureConfiguration()
        };
    }
    
    constructAdvancedFeatureConfiguration() {
        return {
            autoplay: true,           // 👈 Auto-play related songs when queue ends
            centralSystem: true,      // 👈 Enable central music control system
            autoVcCreation: true,     // 👈 🔥 PREMIUM: Auto voice channel creation
            updateStatus: true,       // 👈 Update bot status with current song  
            autoDeaf: true,           // 👈 Auto-deafen bot in voice channels
            autoMute: false,          // 👈 Auto-mute bot in voice channels
            resetOnEnd: true          // 👈 Reset player when queue ends
        };
    }
}

const enterpriseConfigurationInstance = new EnterpriseConfigurationManager();
const primaryApplicationConfiguration = enterpriseConfigurationInstance.initializeConfigurationFramework();

/**
 * Export configuration for application-wide utilization
 * 
 * @type {Object} Comprehensive application configuration object
 */
module.exports = primaryApplicationConfiguration;