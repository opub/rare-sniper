/**
 * Utility functions for logging and error handling
 */

/**
 * Log a message with timestamp to console
 * @param {...any} args - Arguments to log
 */
function log(...args) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}]`, ...args);
}

/**
 * Calculate time elapsed in a human-readable format
 * @param {number} ms - Time elapsed in milliseconds
 * @returns {string} Formatted time string
 */
function elapsed(ms) {
    if (ms < 1000) return `${ms}ms`;
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Handle API request errors with throttling support
 * @param {string} source - Source of the error
 * @param {Error} err - Error object
 * @returns {Promise<boolean>} Whether to retry the request
 */
async function requestError(source, err) {
    const resp = err.response;
    if (resp && resp.status === 429 && resp.config) {
        // hitting the rate limit, wait a bit
        await new Promise(res => setTimeout(res, 5000));
        log('WARN', source, resp.statusText, resp.config.url);
        return true;
    } else {
        log('ERROR', source, 'failed', err.message);
        return false;
    }
}

module.exports = {
    log,
    elapsed,
    requestError
}; 
