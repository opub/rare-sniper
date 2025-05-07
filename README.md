# Rare Sniper

Rare Sniper is a tool that identifies rare NFTs in collections on MagicEden based on their traits. It analyzes collections to find NFTs that have traits which appear in less than a certain percentage of the total collection or are one-of-one traits.

## Features

- Monitors any collection on MagicEden
- Automatically fetches and analyzes NFT metadata
- Analyzes rarity of listed NFTs against the full collection (including unlisted NFTs)
- Identifies rare NFTs based on trait rarity
- Scans collections on a configurable schedule (ensuring no overlap between scans)
- Caches collection data to improve performance across runs
- Persists seen rare NFTs between runs to prevent duplicate notifications
- Limits the number of NFTs fetched for very large collections
- Sends Discord notifications when rare NFTs are found

## Installation

1. Clone this repository
2. Install dependencies using pnpm:

```
cd rare-sniper
pnpm install
```

## Configuration

The application uses the `config` module for configuration settings. You can modify the settings in `config/default.json`:

```json
{
  "magiceden": {
    "api": "https://api-mainnet.magiceden.dev/v2",
    "requestsPerSecond": 2
  },
  "raritySettings": {
    "oneOfOneThreshold": true,
    "percentThreshold": 1,
    "scanIntervalMinutes": 10
  },
  "collectionAnalysis": {
    "cacheFullCollectionData": true,
    "cacheExpireHours": 168,
    "maxNFTsToFetch": 10000
  },
  "notifications": {
    "discord": {
      "enabled": true,
      "webhookUrl": "https://discord.com/api/webhooks/your-webhook-url",
      "username": "ME Rare Sniper"
    }
  }
}
```

### Rarity Settings

- `oneOfOneThreshold`: If true, treat traits that appear only once in the collection as rare
- `percentThreshold`: Percentage threshold below which a trait is considered rare
- `scanIntervalMinutes`: How long to wait after a scan completes before starting the next one

### Collection Analysis Settings

- `cacheFullCollectionData`: Whether to cache the full collection data to avoid re-fetching it on every scan
- `cacheExpireHours`: How long to keep the cached collection data before refreshing it (in hours)
- `maxNFTsToFetch`: Maximum number of NFTs to fetch for the collection analysis (to avoid excessive API calls for very large collections)

### Discord Notifications

- `enabled`: Whether to send Discord notifications when rare NFTs are found
- `webhookUrl`: Your Discord webhook URL
- `username`: The name that will appear as the sender of the Discord messages

## Usage

Run the application with a specific collection symbol:

```
pnpm start <collection-symbol>
```

For example:

```
pnpm start mkrs
```

The application will:
1. Check if there's a valid cached collection data file (if caching is enabled)
2. If there's no valid cache, fetch metadata for the entire collection and save it to the cache
3. Scan for listed NFTs and analyze their rarity against the full collection
4. Wait for the configured interval after the scan completes before starting the next scan
5. Log details of rare NFTs when found
6. Send notifications to Discord if new rare NFTs are found
7. Save a list of seen rare NFTs to avoid duplicate notifications across runs

## How It Works

1. The tool first checks for a cache file containing the collection data (stored in the `cache/` directory)
2. If the cache is valid and not expired, it uses the cached data to avoid re-fetching the entire collection
3. If no valid cache exists, it fetches all NFTs in the collection (up to the configured maximum) and saves them to the cache
4. It then fetches only the currently listed NFTs and checks if any of them have rare traits
5. This approach ensures that rarity is measured against the entire collection, not just the currently listed items
6. When rare NFTs are found, their details are logged and a Discord notification is sent
7. The tool keeps track of which rare NFTs it has already seen to avoid duplicate notifications
8. The tool waits for the specified interval after completing a scan before starting the next one
9. If a scan takes longer than the interval, the next scheduled scan will be skipped until the current one completes

## Cache System

The cache system works as follows:
- Collection data is stored in JSON files in the `cache/` directory
- Each file is named after the collection symbol (e.g., `mkrs.json`)
- The cache is considered valid for the duration specified by `cacheExpireHours` 
- After this period expires, the tool will refresh the cache with new data
- You can manually delete cache files to force a refresh
- A separate cache file (`<collection>_seen.json`) tracks already-seen rare NFTs

## Discord Notifications

When rare NFTs are found, the tool can send notifications to a Discord channel:

1. The notification includes a summary of all new rare NFTs found in the current scan
2. For each NFT, the notification includes:
   - NFT name and image
   - Current price in SOL
   - Links to view the NFT on MagicEden
   - List of rare traits that made this NFT special
3. Notifications are only sent for newly discovered rare NFTs
4. Discord webhooks are used to deliver the notifications, so no bot setup is required

## Handling Large Collections

For very large collections, the tool limits the number of NFTs it will fetch based on the `maxNFTsToFetch` setting. This helps prevent excessive API calls and memory usage. The default limit is 10,000 NFTs, which should be sufficient for most collections while still providing accurate rarity analysis.

## Example Output

```
[2023-05-15T12:34:56.789Z] Created cache directory: /path/to/rare-sniper/cache
[2023-05-15T12:34:56.790Z] Setting up scheduled runs every 10 minutes for collection: mkrs
[2023-05-15T12:34:56.791Z] Collection data caching is ENABLED (expires after 168 hours)
[2023-05-15T12:34:56.792Z] Discord notifications are ENABLED
[2023-05-15T12:34:56.793Z] Starting scan of collection: mkrs
[2023-05-15T12:35:01.123Z] Processing collection: MKRS
[2023-05-15T12:35:05.456Z] Fetching all NFTs in the collection for accurate rarity analysis...
[2023-05-15T12:35:05.457Z] Will fetch up to 10000 NFTs (limit set in config)
[2023-05-15T12:36:30.789Z] Saved 5000 NFTs to cache for collection mkrs
[2023-05-15T12:36:30.790Z] Normalized 5000 NFTs from the entire collection
[2023-05-15T12:36:32.123Z] Completed rarity analysis for the entire collection
[2023-05-15T12:36:35.456Z] Fetching currently listed NFTs...
[2023-05-15T12:36:40.789Z] Found 32 listed NFTs, fetching detailed metadata...
[2023-05-15T12:37:01.123Z] Normalized 32 listed NFTs
[2023-05-15T12:37:02.456Z] Found 3 rare listed NFTs in collection MKRS:
[2023-05-15T12:37:02.457Z] -----------------------------
[2023-05-15T12:37:02.458Z] Name: MKRS #123
[2023-05-15T12:37:02.459Z] Mint: AbCdEf123456789...
[2023-05-15T12:37:02.460Z] Price: 2.5 SOL
[2023-05-15T12:37:02.461Z] Image: https://example.com/nft-image.png
[2023-05-15T12:37:02.462Z] View: https://magiceden.io/item-details/AbCdEf123456789...
[2023-05-15T12:37:02.463Z] Rare traits:
[2023-05-15T12:37:02.464Z]   - Background: Cosmic (0.8%, Below 1% threshold)
[2023-05-15T12:37:02.465Z]   - Eyes: Diamond (0.02%, One of one trait)
[2023-05-15T12:37:02.466Z] Found 3 NEW rare NFTs (total seen so far: 3)
[2023-05-15T12:37:02.467Z] Sent Discord notification with summary of 3 new rare NFTs
[2023-05-15T12:37:02.789Z] Completed scan of mkrs in 2m 6s
[2023-05-15T12:47:02.790Z] Interval reached, starting next scan if previous one has completed
[2023-05-15T12:47:02.791Z] Starting scan of collection: mkrs
[2023-05-15T12:47:05.123Z] Processing collection: MKRS
[2023-05-15T12:47:05.124Z] Using cached data for collection mkrs
[2023-05-15T12:47:05.125Z] Loaded 5000 NFTs from cache for collection mkrs
```

## License

MIT 
