import crypto from 'crypto';
import fs from 'fs';

/**
 * Generate a consistent hash for a file to use as cache key
 * @param {string} filePath - Path to the file
 * @returns {Promise<string>} - SHA256 hash of the file
 */
async function generateFileHash(filePath) {
  try {
    const fileBuffer = await fs.promises.readFile(filePath);
    const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    return hash;
  } catch (error) {
    console.error('❌ Error generating file hash:', error);
    throw error;
  }
}

/**
 * Generate a cache key for audio based on file hash and text content
 * @param {string} fileHash - Hash of the original file
 * @param {string} textContent - Processed text content
 * @returns {string} - Cache key for audio
 */
function generateAudioCacheKey(fileHash, textContent) {
  const contentHash = crypto.createHash('sha256').update(textContent).digest('hex');
  return `${fileHash}-${contentHash}`;
}

export {
  generateFileHash,
  generateAudioCacheKey
}; 