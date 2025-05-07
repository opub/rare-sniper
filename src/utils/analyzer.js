const { log } = require('./logger');
const config = require('config');

/**
 * Flatten NFT attributes into a more usable format
 * @param {Object} nft - NFT object from MagicEden API
 * @returns {Object} Flattened NFT object
 */
function normalizeNFT(nft) {
    if (!nft || !nft.attributes) {
        return null;
    }

    const normalized = {
        mintAddress: nft.mintAddress,
        name: nft.name,
        image: nft.image,
        price: nft.price,
        seller: nft.seller,
        tokenAddress: nft.tokenAddress,
        rarity: {},
        traits: {}
    };

    // Flatten attributes
    nft.attributes.forEach(attr => {
        normalized.traits[attr.trait_type] = attr.value;
    });

    return normalized;
}

/**
 * Count occurrences of each trait value in the collection
 * @param {Array} nfts - Array of normalized NFT objects
 * @returns {Object} Map of trait types to occurrences
 */
function countTraits(nfts) {
    log('Analyzing trait rarity...');
    const traitCounts = {};
    const totalNFTs = nfts.length;

    // Collect all trait types
    const traitTypes = new Set();
    nfts.forEach(nft => {
        Object.keys(nft.traits).forEach(trait => {
            traitTypes.add(trait);
        });
    });

    // Initialize count map for each trait type
    traitTypes.forEach(type => {
        traitCounts[type] = {};
    });

    // Count occurrences of each trait value
    nfts.forEach(nft => {
        traitTypes.forEach(type => {
            const value = nft.traits[type] || 'None';
            traitCounts[type][value] = (traitCounts[type][value] || 0) + 1;
        });
    });

    // Calculate percentages
    traitTypes.forEach(type => {
        Object.keys(traitCounts[type]).forEach(value => {
            const count = traitCounts[type][value];
            const percentage = (count / totalNFTs) * 100;
            traitCounts[type][value] = {
                count,
                percentage: parseFloat(percentage.toFixed(2))
            };
        });
    });

    return { traitCounts, traitTypes: Array.from(traitTypes) };
}

/**
 * Analyze NFTs to identify rare ones based on traits
 * @param {Array} nfts - Array of normalized NFT objects
 * @param {Object} traitAnalysis - Result from countTraits
 * @returns {Array} Rare NFTs that meet the rarity criteria
 */
function findRareNFTs(nfts, traitAnalysis) {
    const { traitCounts, traitTypes } = traitAnalysis;
    const percentThreshold = config.raritySettings.percentThreshold;
    const oneOfOneThreshold = config.raritySettings.oneOfOneThreshold;
    const rareNFTs = [];

    nfts.forEach(nft => {
        let isRare = false;
        const rarityDetails = {};

        // Check each trait for rarity
        traitTypes.forEach(type => {
            const value = nft.traits[type] || 'None';
            const traitStats = traitCounts[type][value];

            if (traitStats) {
                // One of one trait (only one item has this trait value)
                if (oneOfOneThreshold && traitStats.count === 1) {
                    isRare = true;
                    rarityDetails[type] = {
                        value,
                        count: 1,
                        percentage: traitStats.percentage,
                        rare: true,
                        reason: 'One of one trait'
                    };
                }
                // Below percentage threshold
                else if (traitStats.percentage <= percentThreshold) {
                    isRare = true;
                    rarityDetails[type] = {
                        value,
                        count: traitStats.count,
                        percentage: traitStats.percentage,
                        rare: true,
                        reason: `Below ${percentThreshold}% threshold`
                    };
                } else {
                    rarityDetails[type] = {
                        value,
                        count: traitStats.count,
                        percentage: traitStats.percentage,
                        rare: false
                    };
                }
            }
        });

        if (isRare) {
            nft.rarity = rarityDetails;
            rareNFTs.push(nft);
        }
    });

    return rareNFTs;
}

module.exports = {
    normalizeNFT,
    countTraits,
    findRareNFTs
}; 
