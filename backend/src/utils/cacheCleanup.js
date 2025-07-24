import fs from 'fs';
import path from 'path';

/**
 * Clean up cached audio files older than specified days
 * @param {number} maxDays - Maximum age in days for cached files
 * @returns {Promise<number>} - Number of files cleaned up
 */
export async function cleanupOldCache(maxDays = 30) {
  try {
    const cacheDir = path.join(process.cwd(), 'uploads', 'audio-cache');
    
    if (!fs.existsSync(cacheDir)) {
      console.log('🧹 Cache directory does not exist, nothing to clean');
      return 0;
    }

    const files = await fs.promises.readdir(cacheDir);
    const cutoffTime = Date.now() - (maxDays * 24 * 60 * 60 * 1000);
    let deletedCount = 0;

    for (const file of files) {
      const filePath = path.join(cacheDir, file);
      const stats = await fs.promises.stat(filePath);
      
      if (stats.mtime.getTime() < cutoffTime) {
        try {
          await fs.promises.unlink(filePath);
          console.log(`🗑️ Deleted old cached file: ${file}`);
          deletedCount++;
        } catch (error) {
          console.error(`❌ Failed to delete ${file}:`, error.message);
        }
      }
    }

    console.log(`🧹 Cache cleanup completed: ${deletedCount} files deleted`);
    return deletedCount;
  } catch (error) {
    console.error('❌ Cache cleanup failed:', error);
    return 0;
  }
}

/**
 * Get cache statistics
 * @returns {Promise<Object>} - Cache stats object
 */
export async function getCacheStats() {
  try {
    const cacheDir = path.join(process.cwd(), 'uploads', 'audio-cache');
    
    if (!fs.existsSync(cacheDir)) {
      return { totalFiles: 0, totalSize: 0, cacheDir };
    }

    const files = await fs.promises.readdir(cacheDir);
    let totalSize = 0;

    for (const file of files) {
      const filePath = path.join(cacheDir, file);
      const stats = await fs.promises.stat(filePath);
      totalSize += stats.size;
    }

    return {
      totalFiles: files.length,
      totalSize,
      totalSizeMB: Math.round(totalSize / (1024 * 1024) * 100) / 100,
      cacheDir
    };
  } catch (error) {
    console.error('❌ Failed to get cache stats:', error);
    return { totalFiles: 0, totalSize: 0, error: error.message };
  }
} 