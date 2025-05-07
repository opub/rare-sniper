const axios = require('axios');
const config = require('config');
const { log } = require('./logger');

/**
 * Sends a message to Discord webhook about a rare NFT
 * @param {Object} nft - Normalized NFT object with rarity info
 * @param {string} collectionName - Name of the collection
 * @returns {Promise<boolean>} Success status
 */
async function sendRareNFTDiscordNotification(nft, collectionName) {
    if (!config.notifications?.discord?.enabled) {
        return false;
    }

    try {
        const webhookUrl = config.notifications.discord.webhookUrl;
        if (!webhookUrl) {
            log('Discord webhook URL not configured');
            return false;
        }

        // Format price in SOL
        const price = nft.price ? `${nft.price / 1000000000} SOL` : 'Not listed';

        // Find rare traits
        const rareTraits = [];
        Object.entries(nft.rarity).forEach(([trait, details]) => {
            if (details.rare) {
                rareTraits.push(`**${trait}**: ${details.value} (${details.percentage}%, ${details.reason})`);
            }
        });

        // Create embed for Discord message
        const embed = {
            title: `Rare NFT Found: ${nft.name}`,
            description: `A rare NFT was found in collection **${collectionName}**`,
            color: 0x00FFFF, // Cyan color
            thumbnail: {
                url: nft.image
            },
            fields: [
                {
                    name: 'Mint Address',
                    value: nft.mintAddress,
                    inline: false
                },
                {
                    name: 'Price',
                    value: price,
                    inline: true
                },
                {
                    name: 'Rare Traits',
                    value: rareTraits.length > 0 ? rareTraits.join('\n') : 'None',
                    inline: false
                }
            ],
            url: `https://magiceden.io/item-details/${nft.mintAddress}`,
            footer: {
                text: 'Rare Sniper',
                icon_url: 'https://magiceden.io/favicon.ico'
            },
            timestamp: new Date().toISOString()
        };

        // Send to Discord webhook
        const username = config.notifications.discord.username || 'Rare Sniper';
        await axios.post(webhookUrl, {
            username,
            embeds: [embed]
        });

        log(`Sent Discord notification for rare NFT: ${nft.name}`);
        return true;
    } catch (error) {
        log(`Error sending Discord notification: ${error.message}`);
        return false;
    }
}

/**
 * Sends a summary of multiple rare NFTs to Discord webhook
 * @param {Array} nfts - Array of normalized NFT objects with rarity info
 * @param {string} collectionName - Name of the collection
 * @returns {Promise<boolean>} Success status
 */
async function sendRareSummaryDiscordNotification(nfts, collectionName) {
    if (!config.notifications?.discord?.enabled || nfts.length === 0) {
        return false;
    }

    try {
        const webhookUrl = config.notifications.discord.webhookUrl;
        if (!webhookUrl) {
            log('Discord webhook URL not configured');
            return false;
        }

        // Create embeds for Discord message (up to 10 NFTs to stay within Discord limits)
        const embeds = nfts.slice(0, 10).map(nft => {
            // Format price in SOL
            const price = nft.price ? `${nft.price / 1000000000} SOL` : 'Not listed';

            // Find rare traits
            const rareTraits = [];
            Object.entries(nft.rarity).forEach(([trait, details]) => {
                if (details.rare) {
                    rareTraits.push(`**${trait}**: ${details.value} (${details.percentage}%, ${details.reason})`);
                }
            });

            return {
                title: nft.name,
                url: `https://magiceden.io/item-details/${nft.mintAddress}`,
                thumbnail: {
                    url: nft.image
                },
                fields: [
                    {
                        name: 'Price',
                        value: price,
                        inline: true
                    },
                    {
                        name: 'Rare Traits',
                        value: rareTraits.length > 0 ? rareTraits.join('\n') : 'None',
                        inline: false
                    }
                ],
                color: 0x00FFFF // Cyan color
            };
        });

        // Add summary embed
        const summaryEmbed = {
            title: `Rare NFT Summary for ${collectionName}`,
            description: `Found ${nfts.length} rare NFTs in collection **${collectionName}**`,
            color: 0x00FFFF,
            footer: {
                text: 'Rare Sniper',
                icon_url: 'https://magiceden.io/favicon.ico'
            },
            timestamp: new Date().toISOString()
        };

        // Add additional message if we had to truncate the list
        if (nfts.length > 10) {
            summaryEmbed.description += `\n(Showing 10 of ${nfts.length} rare NFTs)`;
        }

        // Send to Discord webhook
        const username = config.notifications.discord.username || 'Rare Sniper';
        await axios.post(webhookUrl, {
            username,
            content: `Found ${nfts.length} rare NFTs in collection **${collectionName}**`,
            embeds: [summaryEmbed, ...embeds]
        });

        log(`Sent Discord summary notification for ${nfts.length} rare NFTs`);
        return true;
    } catch (error) {
        log(`Error sending Discord summary notification: ${error.message}`);
        return false;
    }
}

module.exports = {
    sendRareNFTDiscordNotification,
    sendRareSummaryDiscordNotification
}; 
