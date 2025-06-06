"use strict";
const { v4: uuidv4 } = require("uuid");
const ttsService = require("../services/ttsService");
const storageService = require("../services/storageService");
const User = require("../models/User");
const Usage = require("../models/Usage");
const VoiceFile = require("../models/VoiceFile");
const Subscription = require("../models/Subscription");

//
// ─── GET AVAILABLE VOICES ───────────────────────────────────────────────────────
//
const getVoices = async (req, res) => {
  try {
    const languageCode = req.query.languageCode || null;
    const engine = req.query.engine || "standard";

    const voices = await ttsService.getAvailableVoices(languageCode, engine);

    return res.status(200).json({
      success: true,
      data: voices,
    });
  } catch (error) {
    console.error("Get voices error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch available voices",
    });
  }
};

//
// ─── CONVERT TEXT TO SPEECH ─────────────────────────────────────────────────────
//
const convertTextToSpeech = async (req, res) => {
  try {
    const { text, voiceId, outputFormat = "mp3", engine = "standard" } = req.body;

    // 1) Basic input validation
    if (!text || !voiceId) {
      return res.status(400).json({
        success: false,
        error: "Text and voice ID are required",
      });
    }
    if (text.length > 300000) {
      return res.status(400).json({
        success: false,
        error: "Text cannot exceed 300000 characters",
      });
    }

    // 2) Fetch the user and check subscription
    const user = await User.findById(req.user.id).populate({
      path: "subscription",
      populate: { path: "plan" },
    });

    if (!user.subscription || user.subscription.status !== "active") {
      return res.status(403).json({
        success: false,
        error: "Active subscription required",
      });
    }

    // 3) Get or create the usage record for this month
    const usage = await Usage.getOrCreateCurrentUsage(
      req.user.id,
      user.subscription._id
    );

    // 4) Check if user has enough quota
    if (!usage.hasQuota(text.length)) {
      return res.status(403).json({
        success: false,
        error: "Character limit exceeded for this month",
        data: {
          charactersUsed: usage.charactersUsed,
          charactersLimit: usage.charactersLimit,
          textLength: text.length,
          remaining: usage.getRemainingCharacters(),
          usagePercentage: usage.getUsagePercentage(),
        },
      });
    }

    // 5) Validate the requested voice ID
    const selectedVoice = await ttsService.getVoiceById(voiceId);
    if (!selectedVoice) {
      return res.status(400).json({
        success: false,
        error: "Invalid voice ID",
      });
    }

    // 6) Create initial VoiceFile document with placeholders
    //    (Mongoose requires non‐empty strings for required String fields).
    const filename = `tts_${uuidv4()}.${outputFormat}`;
    const voiceFile = new VoiceFile({
      user: req.user.id,
      filename,
      originalText: text,
      textLength: text.length,
      voice: {
        id: selectedVoice.id,
        name: selectedVoice.name,
        language: selectedVoice.language,
        gender: selectedVoice.gender,
      },
      audioFormat: outputFormat,
      status: "processing",
      // placeholders (must be non‐empty)
      audioUrl: "PENDING",
      s3Key: "PENDING",
      duration: 0,
      fileSize: 0,
    });
    await voiceFile.save();

    try {
      // 7) Synthesize speech using TTS service → returns a Buffer now
      const synthesisResult = await ttsService.synthesizeText(text, voiceId, {
        outputFormat,
        engine,
      });
      // synthesisResult: { audioBuffer: Buffer, contentType: string, requestCharacters: number }

      // 8) Estimate audio duration (seconds)
      const estimatedDuration = ttsService.estimateAudioDuration(text);

      // 9) Upload the Buffer to S3
      const uploadResult = await storageService.uploadAudioFile(
        synthesisResult.audioBuffer,
        req.user.id,
        filename,
        synthesisResult.contentType
      );
      // uploadResult: { key: string, location: string, etag: ..., bucket: ... }

      // 10) Generate a presigned download URL for the uploaded file
      //     ← **THE FIX: add `await` here so audioUrl is a real string, not a Promise**
      const downloadUrl = await storageService.generatePresignedDownloadUrl(
        uploadResult.key,
        filename,
        3600 // 1 hour expiry
      );

      // 11) Overwrite placeholders with real data & save
      voiceFile.s3Key = uploadResult.key;
      voiceFile.audioUrl = downloadUrl;
      voiceFile.fileSize =
        (synthesisResult.audioBuffer && synthesisResult.audioBuffer.length) || 0;
      voiceFile.duration = estimatedDuration;
      voiceFile.status = "completed";
      await voiceFile.save();

      // 12) Update the user’s usage record
      await usage.addUsage(text.length, estimatedDuration);

      // 13) Return final VoiceFile info + updated usage
      return res.status(200).json({
        success: true,
        message: "Text converted to speech successfully",
        data: {
          voiceFile: {
            id: voiceFile._id,
            filename: voiceFile.filename,
            audioUrl: downloadUrl,
            duration: voiceFile.duration,
            fileSize: voiceFile.fileSize,
            voice: voiceFile.voice,
            createdAt: voiceFile.createdAt,
          },
          usage: {
            charactersUsed: usage.charactersUsed,
            charactersLimit: usage.charactersLimit,
            remaining: usage.getRemainingCharacters(),
            usagePercentage: usage.getUsagePercentage(),
          },
        },
      });
    } catch (innerError) {
      // If synthesis or upload fails, mark the document as “failed”
      voiceFile.status = "failed";
      voiceFile.errorMessage = innerError.message;
      await voiceFile.save();
      throw innerError;
    }
  } catch (error) {
    console.error("TTS conversion error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to convert text to speech",
    });
  }
};

//
// ─── GET DOWNLOAD URL FOR A VOICE FILE ───────────────────────────────────────────
//
const getDownloadUrl = async (req, res) => {
  try {
    const { fileId } = req.params;

    const voiceFile = await VoiceFile.findOne({
      _id: fileId,
      user: req.user.id,
      status: "completed",
    });
    if (!voiceFile) {
      return res.status(404).json({
        success: false,
        error: "Voice file not found",
      });
    }

    // Generate a fresh presigned URL
    const downloadUrl = await storageService.generatePresignedDownloadUrl(
      voiceFile.s3Key,
      voiceFile.filename,
      3600 // 1 hour expiry
    );

    // Update download count
    voiceFile.downloadCount += 1;
    voiceFile.lastDownloadedAt = new Date();
    await voiceFile.save();

    return res.status(200).json({
      success: true,
      data: {
        downloadUrl,
        filename: voiceFile.filename,
        expiresIn: 3600,
      },
    });
  } catch (error) {
    console.error("Get download URL error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to generate download URL",
    });
  }
};

//
// ─── PREVIEW VOICE (SHORT SAMPLE) ────────────────────────────────────────────────
//
const previewVoice = async (req, res) => {
  try {
    const { voiceId, sampleText = "Hello, this is a sample of my voice." } =
      req.body;
    if (!voiceId) {
      return res.status(400).json({
        success: false,
        error: "Voice ID is required",
      });
    }

    // Cap preview length to 100 characters
    const limitedText = sampleText.substring(0, 100);

    // Synthesize a small sample (returns audioBuffer)
    const synthesisResult = await ttsService.synthesizeText(limitedText, voiceId, {
      outputFormat: "mp3",
      engine: "standard",
    });
    // synthesisResult: { audioBuffer: Buffer, contentType, requestCharacters }

    // Stream it back directly in the response
    res.set({
      "Content-Type": synthesisResult.contentType,
      "Content-Length": synthesisResult.audioBuffer.length,
      'Content-Disposition': 'inline; filename="voice-preview.mp3"',
    });
    return res.send(synthesisResult.audioBuffer);
  } catch (error) {
    console.error("Voice preview error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to generate voice preview",
    });
  }
};

module.exports = {
  getVoices,
  convertTextToSpeech,
  getDownloadUrl,
  previewVoice,
};
