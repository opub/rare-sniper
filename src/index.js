require('dotenv').config();
const config = require('config');
const meAPI = require('./api/magiceden');
const { normalizeNFT, countTraits, findRareNFTs } = require('./utils/analyzer');
const { log, elapsed } = require('./utils/logger');
const { loadFromCache, saveToCache, loadSeenRareNFTs, saveSeenRareNFTs } = require('./utils/cache');
const { sendRareSummaryDiscordNotification } = require('./utils/notifications');

// Cache to prevent duplicate notifications for the same rare NFTs
let seenRareNFTs;
// Flag to track if a scan is currently running
let isScanRunning = false;
// Current collection being processed
let currentCollection = null;

/**
 * Process a single collection to find rare NFTs
 * @param {string} collectionSymbol - MagicEden collection symbol
 */
async function processCollection(collectionSymbol) {
    const startTime = Date.now();
    log(`Starting scan of collection: ${collectionSymbol}`);

    try {
        // Get collection info and stats
        const collectionInfo = await meAPI.getCollectionInfo(collectionSymbol);
        if (!collectionInfo) {
            log(`Collection not found: ${collectionSymbol}`);
            return;
        }

        log(`Processing collection: ${collectionInfo.name}`);

        // Get all NFTs in the collection for rarity analysis (from cache or API)
        let allNFTs = [];

        // Try to load from cache first
        const cachedNFTs = loadFromCache(collectionSymbol);
        if (cachedNFTs && cachedNFTs.length > 0) {
            allNFTs = cachedNFTs;
            log(`Using cached data for collection ${collectionSymbol}`);
        } else {
            // Cache miss or disabled - fetch from API
            log(`Fetching all NFTs in the collection for accurate rarity analysis...`);
            allNFTs = await meAPI.getAllCollectionNFTs(collectionSymbol);

            // Save to cache if we have data and caching is enabled
            if (allNFTs && allNFTs.length > 0) {
                saveToCache(collectionSymbol, allNFTs);
            }
        }

        if (!allNFTs || allNFTs.length === 0) {
            log(`No NFTs found for collection: ${collectionSymbol}`);
            return;
        }

        // Normalize all NFTs for trait analysis
        const normalizedAllNFTs = allNFTs
            .map(nft => normalizeNFT(nft))
            .filter(nft => nft !== null);

        log(`Normalized ${normalizedAllNFTs.length} NFTs from the entire collection`);

        // Calculate trait rarity based on the entire collection
        const traitAnalysis = countTraits(normalizedAllNFTs);
        log(`Completed rarity analysis for the entire collection`);

        // Now fetch only the listed NFTs
        log(`Fetching currently listed NFTs...`);
        const listedNFTs = await meAPI.getCollectionListings(collectionSymbol);

        if (!listedNFTs || listedNFTs.length === 0) {
            log(`No listed NFTs found for collection: ${collectionSymbol}`);
            return;
        }

        log(`Found ${listedNFTs.length} listed NFTs, fetching detailed metadata...`);

        // Fetch detailed metadata for each listed NFT and normalize data
        const normalizedListedNFTs = [];
        for (const listing of listedNFTs) {
            const nftDetails = await meAPI.getNFTMetadata(listing.tokenMint);
            if (nftDetails) {
                const normalized = normalizeNFT(nftDetails);
                if (normalized) {
                    // Add price info from listing
                    normalized.price = listing.price;
                    normalized.seller = listing.seller;
                    normalizedListedNFTs.push(normalized);
                }
            }
        }

        log(`Normalized ${normalizedListedNFTs.length} listed NFTs`);

        // Find rare NFTs among the listings, using the rarity analysis from the entire collection
        const rareListedNFTs = findRareNFTs(normalizedListedNFTs, traitAnalysis);

        if (rareListedNFTs.length > 0) {
            log(`Found ${rareListedNFTs.length} rare listed NFTs in collection ${collectionInfo.name}:`);
            let newRareNFTsFound = 0;
            const newRareNFTs = [];

            rareListedNFTs.forEach(nft => {
                // Skip if we've seen this NFT before
                if (seenRareNFTs.has(nft.mintAddress)) {
                    return;
                }

                // New rare NFT found
                newRareNFTsFound++;
                newRareNFTs.push(nft);

                // Add to seen set
                seenRareNFTs.add(nft.mintAddress);

                // Format price
                const price = nft.price ? `${nft.price / 1000000000} SOL` : 'Not listed';

                // Find rare traits
                const rareTraits = [];
                Object.entries(nft.rarity).forEach(([trait, details]) => {
                    if (details.rare) {
                        rareTraits.push(`${trait}: ${details.value} (${details.percentage}%, ${details.reason})`);
                    }
                });

                // Log the rare NFT details
                log(`-----------------------------`);
                log(`Name: ${nft.name}`);
                log(`Mint: ${nft.mintAddress}`);
                log(`Price: ${price}`);
                log(`Image: ${nft.image}`);
                log(`View: https://magiceden.io/item-details/${nft.mintAddress}`);
                log(`Rare traits:`);
                rareTraits.forEach(trait => log(`  - ${trait}`));
            });

            // Save the updated seenRareNFTs list
            saveSeenRareNFTs(collectionSymbol, seenRareNFTs);

            log(`Found ${newRareNFTsFound} NEW rare NFTs (total seen so far: ${seenRareNFTs.size})`);

            // Send Discord notification if new rare NFTs were found
            if (newRareNFTs.length > 0) {
                const discordSent = await sendRareSummaryDiscordNotification(newRareNFTs, collectionInfo.name);
                if (discordSent) {
                    log(`Sent Discord notification with summary of ${newRareNFTs.length} new rare NFTs`);
                }
            }
        } else {
            log(`No rare listed NFTs found in collection ${collectionInfo.name}`);
        }
    } catch (error) {
        log(`Error processing collection ${collectionSymbol}:`, error);
    }

    log(`Completed scan of ${collectionSymbol} in ${elapsed(Date.now() - startTime)}`);
}

/**
 * Main function that processes a collection
 * @param {string} collectionSymbol - MagicEden collection symbol
 */
async function main(collectionSymbol) {
    if (!collectionSymbol) {
        log('Usage: npm start <collection-symbol>');
        log('Example: npm start mkrs');
        process.exit(1);
    }

    // Store the current collection symbol
    currentCollection = collectionSymbol;

    // If a scan is already running, skip this run
    if (isScanRunning) {
        log('Previous scan still running, skipping this scheduled run');
        return;
    }

    try {
        isScanRunning = true;
        await processCollection(collectionSymbol);
    } catch (error) {
        log('Error in main process:', error);
    } finally {
        isScanRunning = false;
    }
}

/**
 * Run the application with scheduled interval
 */
function setupIntervalRuns() {
    const collectionSymbol = process.argv[2];
    if (!collectionSymbol) {
        log('Usage: npm start <collection-symbol>');
        log('Example: npm start mkrs');
        process.exit(1);
    }

    // Initialize seenRareNFTs from persisted state
    seenRareNFTs = loadSeenRareNFTs(collectionSymbol);

    const intervalMinutes = config.raritySettings.scanIntervalMinutes;
    log(`Setting up scheduled runs every ${intervalMinutes} minutes for collection: ${collectionSymbol}`);

    // Show caching info
    const cacheEnabled = config.collectionAnalysis.cacheFullCollectionData;
    const cacheExpireHours = config.collectionAnalysis.cacheExpireHours;
    if (cacheEnabled) {
        log(`Collection data caching is ENABLED (expires after ${cacheExpireHours} hours)`);
    } else {
        log(`Collection data caching is DISABLED`);
    }

    // Show Discord notification status
    const discordEnabled = config.notifications?.discord?.enabled;
    if (discordEnabled) {
        log(`Discord notifications are ENABLED`);
    } else {
        log(`Discord notifications are DISABLED`);
    }

    // Handle application termination
    process.on('SIGINT', () => {
        log('Application terminating, saving data...');
        if (currentCollection && seenRareNFTs) {
            saveSeenRareNFTs(currentCollection, seenRareNFTs);
        }
        process.exit(0);
    });

    // Run immediately on startup
    main(collectionSymbol);

    // Use setInterval with delay instead of cron for better control
    setInterval(() => {
        log(`Interval reached, starting next scan if previous one has completed`);
        main(collectionSymbol);
    }, intervalMinutes * 60 * 1000);
}

// Start the application with interval runs
setupIntervalRuns(); 
