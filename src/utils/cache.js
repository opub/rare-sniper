const fs = require('fs');
const path = require('path');
const config = require('config');
const { log } = require('./logger');

// Create cache directory if it doesn't exist
const CACHE_DIR = path.join(process.cwd(), 'cache');
if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    log(`Created cache directory: ${CACHE_DIR}`);
}

/**
 * Get the cache file path for a collection
 * @param {string} collectionSymbol - Collection symbol
 * @returns {string} Cache file path
 */
function getCacheFilePath(collectionSymbol) {
    return path.join(CACHE_DIR, `${collectionSymbol}.json`);
}

/**
 * Get the path for the seen rare NFTs file
 * @param {string} collectionSymbol - Collection symbol
 * @returns {string} Path to the seen rare NFTs file
 */
function getSeenRareNFTsPath(collectionSymbol) {
    return path.join(CACHE_DIR, `${collectionSymbol}_seen.json`);
}

/**
 * Check if a valid cache exists for a collection
 * @param {string} collectionSymbol - Collection symbol 
 * @returns {boolean} Whether valid cache exists
 */
function cacheExists(collectionSymbol) {
    const cachePath = getCacheFilePath(collectionSymbol);

    if (!fs.existsSync(cachePath)) {
        return false;
    }

    try {
        const stats = fs.statSync(cachePath);
        const fileModifiedTime = stats.mtime.getTime();
        const currentTime = new Date().getTime();

        // Check if cache is expired
        const cacheExpireHours = config.collectionAnalysis.cacheExpireHours;
        const cacheExpirationMs = cacheExpireHours * 60 * 60 * 1000;

        if (currentTime - fileModifiedTime > cacheExpirationMs) {
            log(`Cache for ${collectionSymbol} is expired (${cacheExpireHours} hours)`);
            return false;
        }

        return true;
    } catch (error) {
        log(`Error checking cache for ${collectionSymbol}:`, error);
        return false;
    }
}

/**
 * Save collection data to cache
 * @param {string} collectionSymbol - Collection symbol
 * @param {Array} data - Collection data to cache
 * @returns {boolean} Whether cache was saved successfully
 */
function saveToCache(collectionSymbol, data) {
    if (!config.collectionAnalysis.cacheFullCollectionData) {
        return false;
    }

    try {
        const cachePath = getCacheFilePath(collectionSymbol);
        fs.writeFileSync(cachePath, JSON.stringify(data, null, 2));
        log(`Saved ${data.length} NFTs to cache for collection ${collectionSymbol}`);
        return true;
    } catch (error) {
        log(`Error saving cache for ${collectionSymbol}:`, error);
        return false;
    }
}

/**
 * Load collection data from cache
 * @param {string} collectionSymbol - Collection symbol
 * @returns {Array|null} Cached collection data or null if no valid cache
 */
function loadFromCache(collectionSymbol) {
    if (!config.collectionAnalysis.cacheFullCollectionData) {
        return null;
    }

    if (!cacheExists(collectionSymbol)) {
        return null;
    }

    try {
        const cachePath = getCacheFilePath(collectionSymbol);
        const cachedData = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        log(`Loaded ${cachedData.length} NFTs from cache for collection ${collectionSymbol}`);
        return cachedData;
    } catch (error) {
        log(`Error loading cache for ${collectionSymbol}:`, error);
        return null;
    }
}

/**
 * Save seen rare NFTs to a file to persist between runs
 * @param {string} collectionSymbol - Collection symbol
 * @param {Set} seenRareNFTs - Set of seen rare NFT mint addresses
 * @returns {boolean} Whether save was successful
 */
function saveSeenRareNFTs(collectionSymbol, seenRareNFTs) {
    try {
        const filePath = getSeenRareNFTsPath(collectionSymbol);
        const seenArray = Array.from(seenRareNFTs);
        fs.writeFileSync(filePath, JSON.stringify(seenArray, null, 2));
        log(`Saved ${seenArray.length} seen rare NFTs for collection ${collectionSymbol}`);
        return true;
    } catch (error) {
        log(`Error saving seen rare NFTs for ${collectionSymbol}:`, error);
        return false;
    }
}

/**
 * Load seen rare NFTs from file
 * @param {string} collectionSymbol - Collection symbol
 * @returns {Set} Set of seen rare NFT mint addresses
 */
function loadSeenRareNFTs(collectionSymbol) {
    const filePath = getSeenRareNFTsPath(collectionSymbol);

    if (!fs.existsSync(filePath)) {
        log(`No saved seen rare NFTs file found for ${collectionSymbol}`);
        return new Set();
    }

    try {
        const seenArray = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const seenSet = new Set(seenArray);
        log(`Loaded ${seenSet.size} seen rare NFTs for collection ${collectionSymbol}`);
        return seenSet;
    } catch (error) {
        log(`Error loading seen rare NFTs for ${collectionSymbol}:`, error);
        return new Set();
    }
}

/**
 * Clear cache for a collection
 * @param {string} collectionSymbol - Collection symbol
 * @returns {boolean} Whether cache was cleared successfully
 */
function clearCache(collectionSymbol) {
    try {
        const cachePath = getCacheFilePath(collectionSymbol);
        if (fs.existsSync(cachePath)) {
            fs.unlinkSync(cachePath);
            log(`Cleared cache for collection ${collectionSymbol}`);
        }
        return true;
    } catch (error) {
        log(`Error clearing cache for ${collectionSymbol}:`, error);
        return false;
    }
}

module.exports = {
    cacheExists,
    saveToCache,
    loadFromCache,
    saveSeenRareNFTs,
    loadSeenRareNFTs,
    clearCache
}; 
