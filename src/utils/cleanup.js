"use strict";
const VoiceFile = require('../models/VoiceFile');
const storageService = require('../services/storageService');
const otpService = require('../services/otpService');

class CleanupService {
  constructor() {
    this.isRunning = false;
  }

  // Clean up expired voice files (older than 90 days)
  async cleanupExpiredFiles() {
    try {
      console.log('Starting cleanup of expired voice files...');
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 90); // 90 days ago

      // Find expired files
      const expiredFiles = await VoiceFile.find({
        createdAt: { $lt: cutoffDate },
        status: 'completed'
      });

      console.log(`Found ${expiredFiles.length} expired files to delete`);

      let deletedCount = 0;
      let errorCount = 0;

      for (const file of expiredFiles) {
        try {
          // Delete from S3
          if (file.s3Key) {
            await storageService.deleteFile(file.s3Key);
          }

          // Delete from database
          await VoiceFile.findByIdAndDelete(file._id);
          deletedCount++;

          console.log(`Deleted expired file: ${file.filename} (${file._id})`);
        } catch (error) {
          console.error(`Error deleting file ${file.filename}:`, error);
          errorCount++;
        }
      }

      console.log(`Cleanup completed: ${deletedCount} files deleted, ${errorCount} errors`);
      return { deletedCount, errorCount };
    } catch (error) {
      console.error('Error during file cleanup:', error);
      throw error;
    }
  }

  // Clean up expired OTPs
  async cleanupExpiredOTPs() {
    try {
      console.log('Starting cleanup of expired OTPs...');
      const deletedCount = await otpService.cleanupExpiredOTPs();
      console.log(`OTP cleanup completed: ${deletedCount} OTPs deleted`);
      return deletedCount;
    } catch (error) {
      console.error('Error during OTP cleanup:', error);
      throw error;
    }
  }

  // Clean up failed voice file records (older than 7 days)
  async cleanupFailedFiles() {
    try {
      console.log('Starting cleanup of failed voice files...');
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 7); // 7 days ago

      const result = await VoiceFile.deleteMany({
        status: 'failed',
        createdAt: { $lt: cutoffDate }
      });

      console.log(`Failed files cleanup completed: ${result.deletedCount} records deleted`);
      return result.deletedCount;
    } catch (error) {
      console.error('Error during failed files cleanup:', error);
      throw error;
    }
  }

  // Clean up orphaned S3 files (files in S3 but not in database)
  async cleanupOrphanedS3Files() {
    try {
      console.log('Starting cleanup of orphaned S3 files...');
      
      // Get all S3 files
      const s3Files = await storageService.listUserFiles('', 'audio');
      
      // Get all database file keys
      const dbFiles = await VoiceFile.find({}, 's3Key').lean();
      const dbKeys = new Set(dbFiles.map(file => file.s3Key));

      // Find orphaned files
      const orphanedFiles = s3Files.filter(s3File => !dbKeys.has(s3File.key));
      
      console.log(`Found ${orphanedFiles.length} orphaned S3 files`);

      if (orphanedFiles.length === 0) {
        return 0;
      }

      // Delete orphaned files (only if they're older than 1 day to avoid race conditions)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const filesToDelete = orphanedFiles.filter(file => file.lastModified < oneDayAgo);

      if (filesToDelete.length === 0) {
        console.log('No old orphaned files found to delete');
        return 0;
      }

      const keysToDelete = filesToDelete.map(file => file.key);
      const deleteResult = await storageService.deleteMultipleFiles(keysToDelete);

      console.log(`Orphaned files cleanup completed: ${deleteResult.deleted.length} files deleted`);
      return deleteResult.deleted.length;
    } catch (error) {
      console.error('Error during orphaned files cleanup:', error);
      throw error;
    }
  }

  // Run all cleanup tasks
  async runFullCleanup() {
    if (this.isRunning) {
      console.log('Cleanup is already running, skipping...');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      console.log('=== Starting full cleanup process ===');

      const results = await Promise.allSettled([
        this.cleanupExpiredFiles(),
        this.cleanupExpiredOTPs(),
        this.cleanupFailedFiles(),
        this.cleanupOrphanedS3Files()
      ]);

      const summary = {
        expiredFiles: results[0].status === 'fulfilled' ? results[0].value.deletedCount : 0,
        expiredOTPs: results[1].status === 'fulfilled' ? results[1].value : 0,
        failedFiles: results[2].status === 'fulfilled' ? results[2].value : 0,
        orphanedFiles: results[3].status === 'fulfilled' ? results[3].value : 0,
        errors: results.filter(r => r.status === 'rejected').length,
        duration: Date.now() - startTime
      };

      console.log('=== Cleanup Summary ===');
      console.log(`Expired files deleted: ${summary.expiredFiles}`);
      console.log(`Expired OTPs deleted: ${summary.expiredOTPs}`);
      console.log(`Failed files deleted: ${summary.failedFiles}`);
      console.log(`Orphaned files deleted: ${summary.orphanedFiles}`);
      console.log(`Errors encountered: ${summary.errors}`);
      console.log(`Total duration: ${summary.duration}ms`);
      console.log('=== Cleanup completed ===');

      return summary;
    } catch (error) {
      console.error('Error during full cleanup:', error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  // Schedule cleanup to run periodically
  scheduleCleanup(intervalHours = 24) {
    console.log(`Scheduling cleanup to run every ${intervalHours} hours`);
    
    // Run immediately
    this.runFullCleanup().catch(error => {
      console.error('Initial cleanup failed:', error);
    });

    // Schedule recurring cleanup
    setInterval(async () => {
      try {
        await this.runFullCleanup();
      } catch (error) {
        console.error('Scheduled cleanup failed:', error);
      }
    }, intervalHours * 60 * 60 * 1000);
  }

  // Manual cleanup endpoint for admin
  async manualCleanup(type = 'all') {
    try {
      switch (type) {
        case 'files':
          return await this.cleanupExpiredFiles();
        case 'otps':
          return await this.cleanupExpiredOTPs();
        case 'failed':
          return await this.cleanupFailedFiles();
        case 'orphaned':
          return await this.cleanupOrphanedS3Files();
        case 'all':
        default:
          return await this.runFullCleanup();
      }
    } catch (error) {
      console.error(`Manual cleanup (${type}) failed:`, error);
      throw error;
    }
  }
}

module.exports = new CleanupService();
