const config = require('config');
const axios = require('axios');
const axiosThrottle = require('axios-request-throttle');
const { log, requestError } = require('../utils/logger');

const API = config.magiceden.api;
axiosThrottle.use(axios, { requestsPerSecond: config.magiceden.requestsPerSecond });

/**
 * Get collection metadata and statistics
 * @param {string} symbol - Collection symbol
 * @returns {Promise<object>} Collection metadata
 */
async function getCollectionInfo(symbol) {
    try {
        const url = `${API}/collections/${symbol}`;
        const { data } = await axios.get(url);
        return data;
    } catch (e) {
        await requestError('getCollectionInfo', e);
        return null;
    }
}

/**
 * Get collection statistics including floor price
 * @param {string} symbol - Collection symbol
 * @returns {Promise<object>} Collection statistics
 */
async function getCollectionStats(symbol) {
    try {
        const url = `${API}/collections/${symbol}/stats`;
        const { data } = await axios.get(url);
        return data;
    } catch (e) {
        await requestError('getCollectionStats', e);
        return null;
    }
}

/**
 * Get all listed NFTs in a collection
 * @param {string} symbol - Collection symbol
 * @returns {Promise<Array>} Array of listed NFT metadata
 */
async function getCollectionListings(symbol) {
    log(`Fetching all listed NFTs for collection: ${symbol}`);
    const limit = 500;
    let allListings = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
        try {
            const url = `${API}/collections/${symbol}/listings?offset=${offset}&limit=${limit}`;
            const { data } = await axios.get(url);

            if (data && data.length > 0) {
                allListings.push(...data);
                offset += limit;
                log(`Fetched ${allListings.length} listed NFTs so far...`);

                // If we received fewer than the limit, we're done
                if (data.length < limit) {
                    hasMore = false;
                }
            } else {
                hasMore = false;
            }
        } catch (e) {
            const retry = await requestError('getCollectionListings', e);
            if (!retry) hasMore = false;
        }
    }

    log(`Completed fetching ${allListings.length} listed NFTs for collection: ${symbol}`);
    return allListings;
}

/**
 * Get all NFTs in a collection (both listed and unlisted)
 * @param {string} symbol - Collection symbol
 * @returns {Promise<Array>} Array of all NFT metadata
 */
async function getAllCollectionNFTs(symbol) {
    log(`Fetching all NFTs (including unlisted) for collection: ${symbol}`);
    const limit = 500;
    let allNFTs = [];
    let offset = 0;
    let hasMore = true;

    // Get max NFTs to fetch from config
    const maxNFTsToFetch = config.collectionAnalysis.maxNFTsToFetch;
    log(`Will fetch up to ${maxNFTsToFetch} NFTs (limit set in config)`);

    while (hasMore) {
        try {
            // This endpoint returns all tokens in a collection, not just listings
            const url = `${API}/collections/${symbol}/activities?offset=${offset}&limit=${limit}`;
            const { data } = await axios.get(url);

            if (data && data.length > 0) {
                // Extract unique token addresses from activities
                const uniqueTokens = [...new Set(data
                    .filter(activity => activity.tokenMint)
                    .map(activity => activity.tokenMint))];

                // For each unique token, fetch its metadata
                for (const mint of uniqueTokens) {
                    // Stop if we've reached the configured limit
                    if (allNFTs.length >= maxNFTsToFetch) {
                        log(`Reached configured limit of ${maxNFTsToFetch} NFTs, stopping collection`);
                        hasMore = false;
                        break;
                    }

                    if (!allNFTs.some(nft => nft.mintAddress === mint)) {
                        try {
                            const metadata = await getNFTMetadata(mint);
                            if (metadata) {
                                allNFTs.push(metadata);
                            }
                        } catch (metadataError) {
                            log(`Error fetching metadata for ${mint}:`, metadataError);
                        }
                    }
                }

                offset += limit;
                log(`Processed ${data.length} activities, found ${allNFTs.length} NFTs total`);

                // If we received fewer than the limit or reached max, we're done
                if (data.length < limit || allNFTs.length >= maxNFTsToFetch) {
                    hasMore = false;
                }
            } else {
                hasMore = false;
            }
        } catch (e) {
            const retry = await requestError('getAllCollectionNFTs', e);
            if (!retry) hasMore = false;
        }
    }

    log(`Completed fetching ${allNFTs.length} total NFTs for collection: ${symbol}`);
    return allNFTs;
}

/**
 * Get detailed metadata for a specific NFT
 * @param {string} mintAddress - NFT mint address
 * @returns {Promise<object>} NFT metadata
 */
async function getNFTMetadata(mintAddress) {
    try {
        const url = `${API}/tokens/${mintAddress}`;
        const { data } = await axios.get(url);
        return data;
    } catch (e) {
        await requestError('getNFTMetadata', e);
        return null;
    }
}

module.exports = {
    getCollectionInfo,
    getCollectionStats,
    getCollectionListings,
    getAllCollectionNFTs,
    getNFTMetadata
}; 
