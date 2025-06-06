"use strict";
const { 
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutBucketLifecycleConfigurationCommand,
  GetObjectCommand
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { v4: uuidv4 } = require('uuid');

class StorageService {
  constructor() {
    this.s3 = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    });
    
    this.bucketName = process.env.S3_BUCKET_NAME || 'tts-audio-files';
    this.defaultExpiration = 3600; // 1 hour for presigned URLs
  }

  async uploadAudioFile(audioStream, userId, filename, contentType = 'audio/mpeg') {
    try {
      const key = `audio/${userId}/${uuidv4()}-${filename}`;
      
      const uploadParams = {
        Bucket: this.bucketName,
        Key: key,
        Body: audioStream,
        ContentType: contentType,
        Metadata: {
          userId: userId.toString(),
          uploadedAt: new Date().toISOString()
        }
      };

      const command = new PutObjectCommand(uploadParams);
      await this.s3.send(command);
      
      return {
        key: key,
        location: `https://${this.bucketName}.s3.amazonaws.com/${key}`,
        etag: null,
        bucket: this.bucketName
      };
    } catch (error) {
      console.error('Error uploading audio file to S3:', error);
      throw new Error('Failed to upload audio file');
    }
  }

  async uploadPaymentProof(fileBuffer, userId, originalFilename, contentType) {
    try {
      const fileExtension = originalFilename.split('.').pop();
      const key = `payment-proofs/${userId}/${uuidv4()}.${fileExtension}`;
      
      const uploadParams = {
        Bucket: this.bucketName,
        Key: key,
        Body: fileBuffer,
        ContentType: contentType,
        Metadata: {
          userId: userId.toString(),
          originalFilename: originalFilename,
          uploadedAt: new Date().toISOString()
        }
      };

      const command = new PutObjectCommand(uploadParams);
      await this.s3.send(command);
      
      return {
        key: key,
        location: `https://${this.bucketName}.s3.amazonaws.com/${key}`,
        etag: null,
        bucket: this.bucketName
      };
    } catch (error) {
      console.error('Error uploading payment proof to S3:', error);
      throw new Error('Failed to upload payment proof');
    }
  }

  async deleteFile(key) {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });

      await this.s3.send(command);
      console.log(`File deleted successfully: ${key}`);
      return true;
    } catch (error) {
      console.error('Error deleting file from S3:', error);
      throw new Error('Failed to delete file');
    }
  }

  async deleteMultipleFiles(keys) {
    try {
      if (!keys || keys.length === 0) {
        return { deleted: [], errors: [] };
      }

      const command = new DeleteObjectsCommand({
        Bucket: this.bucketName,
        Delete: {
          Objects: keys.map(key => ({ Key: key })),
          Quiet: false
        }
      });

      const result = await this.s3.send(command);
      
      return {
        deleted: result.Deleted || [],
        errors: result.Errors || []
      };
    } catch (error) {
      console.error('Error deleting multiple files from S3:', error);
      throw new Error('Failed to delete files');
    }
  }

  async generatePresignedUrl(key, expiresIn = null) {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });

      return await getSignedUrl(this.s3, command, { expiresIn: expiresIn || this.defaultExpiration });
    } catch (error) {
      console.error('Error generating presigned URL:', error);
      throw new Error('Failed to generate download URL');
    }
  }

  async generatePresignedDownloadUrl(key, filename, expiresIn = null) {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        ResponseContentDisposition: `attachment; filename="${filename}"`
      });

      return await getSignedUrl(this.s3, command, { expiresIn: expiresIn || this.defaultExpiration });
    } catch (error) {
      console.error('Error generating presigned download URL:', error);
      throw new Error('Failed to generate download URL');
    }
  }

  async getFileMetadata(key) {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });

      const result = await this.s3.send(command);
      
      return {
        contentType: result.ContentType,
        contentLength: result.ContentLength,
        lastModified: result.LastModified,
        etag: result.ETag,
        metadata: result.Metadata
      };
    } catch (error) {
      console.error('Error getting file metadata:', error);
      throw new Error('Failed to get file metadata');
    }
  }

  async fileExists(key) {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });
      await this.s3.send(command);
      return true;
    } catch (error) {
      if (error.name === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  async listUserFiles(userId, prefix = 'audio') {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: `${prefix}/${userId}/`,
        MaxKeys: 1000
      });

      const result = await this.s3.send(command);
      
      return result.Contents.map(object => ({
        key: object.Key,
        size: object.Size,
        lastModified: object.LastModified,
        etag: object.ETag
      }));
    } catch (error) {
      console.error('Error listing user files:', error);
      throw new Error('Failed to list user files');
    }
  }

  async cleanupExpiredFiles(daysOld = 90) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: 'audio/'
      });

      const result = await this.s3.send(command);
      const expiredFiles = result.Contents.filter(object => 
        object.LastModified < cutoffDate
      );

      if (expiredFiles.length === 0) {
        console.log('No expired files found');
        return { deletedCount: 0, errors: [] };
      }

      const keysToDelete = expiredFiles.map(file => file.Key);
      const deleteResult = await this.deleteMultipleFiles(keysToDelete);

      console.log(`Cleaned up ${deleteResult.deleted.length} expired files`);
      return {
        deletedCount: deleteResult.deleted.length,
        errors: deleteResult.errors
      };
    } catch (error) {
      console.error('Error cleaning up expired files:', error);
      throw new Error('Failed to cleanup expired files');
    }
  }

  async getUserStorageUsage(userId) {
    try {
      const audioFiles = await this.listUserFiles(userId, 'audio');
      const paymentFiles = await this.listUserFiles(userId, 'payment-proofs');
      
      const totalSize = [...audioFiles, ...paymentFiles].reduce((sum, file) => sum + file.size, 0);
      
      return {
        totalFiles: audioFiles.length + paymentFiles.length,
        audioFiles: audioFiles.length,
        paymentFiles: paymentFiles.length,
        totalSizeBytes: totalSize,
        totalSizeMB: Math.round(totalSize / (1024 * 1024) * 100) / 100
      };
    } catch (error) {
      console.error('Error calculating user storage usage:', error);
      throw new Error('Failed to calculate storage usage');
    }
  }

  // Configure S3 bucket lifecycle rules (call this during setup)
  async configureBucketLifecycle() {
    try {
      const command = new PutBucketLifecycleConfigurationCommand({
        Bucket: this.bucketName,
        LifecycleConfiguration: {
          Rules: [
            {
              ID: 'DeleteOldAudioFiles',
              Status: 'Enabled',
              Filter: {
                Prefix: 'audio/'
              },
              Expiration: {
                Days: 90
              }
            },
            {
              ID: 'DeleteOldPaymentProofs',
              Status: 'Enabled',
              Filter: {
                Prefix: 'payment-proofs/'
              },
              Expiration: {
                Days: 365 // Keep payment proofs longer for compliance
              }
            }
          ]
        }
      });

      await this.s3.send(command);
      console.log('S3 bucket lifecycle rules configured successfully');
    } catch (error) {
      console.error('Error configuring S3 lifecycle rules:', error);
      // Don't throw error as this is optional configuration
    }
  }
}

module.exports = new StorageService();
