"use strict";
const { DescribeVoicesCommand, SynthesizeSpeechCommand } = require("@aws-sdk/client-polly");
const pollyConfig = require("../config/polly"); // your existing Polly client setup

class TTSService {
  constructor() {
    this.polly = pollyConfig.polly; 
    this.supportedFormats = ["mp3", "wav", "ogg"];
    this.supportedEngines = ["standard", "neural"];
  }

  /**
   * Fetches available voices from Amazon Polly.
   * @param {string|null} languageCode
   * @param {string} engine
   * @returns {Promise<Array>}
   */
  async getAvailableVoices(languageCode = null, engine = "standard") {
    try {
      const params = {
        LanguageCode: languageCode || undefined,
        Engine: engine,
      };

      const command = new DescribeVoicesCommand(params);
      const response = await this.polly.send(command);

      return response.Voices.map((voice) => ({
        id: voice.Id,
        name: voice.Name,
        language: voice.LanguageCode,
        languageName: voice.LanguageName,
        gender: voice.Gender,
        supportedEngines: voice.SupportedEngines,
        additionalLanguageCodes: voice.AdditionalLanguageCodes || [],
      }));
    } catch (error) {
      console.error("Error fetching voices from Polly:", error);
      throw new Error("Failed to fetch available voices");
    }
  }

  /**
   * Synthesizes the given text into speech, returning a Buffer (and metadata).
   * - Consumes Polly’s response.AudioStream into a Buffer so we know its length.
   * @param {string} text
   * @param {string} voiceId
   * @param {object} options
   * @param {string} options.outputFormat
   * @param {string} options.engine
   * @param {string|null} options.sampleRate
   * @param {Array|null} options.speechMarkTypes
   * @returns {Promise<{ audioBuffer: Buffer, contentType: string, requestCharacters: number }>}
   */
  async synthesizeText(text, voiceId, options = {}) {
    try {
      const {
        outputFormat = "mp3",
        engine = "standard",
        sampleRate = null,
        speechMarkTypes = null,
      } = options;

      // Validate inputs
      if (!text || !voiceId) {
        throw new Error("Text and voice ID are required");
      }
      if (!this.supportedFormats.includes(outputFormat)) {
        throw new Error(`Unsupported output format: ${outputFormat}`);
      }
      if (!this.supportedEngines.includes(engine)) {
        throw new Error(`Unsupported engine: ${engine}`);
      }

      // Prepare Polly parameters
      const pollyParams = {
        Text: text,
        VoiceId: voiceId,
        OutputFormat: outputFormat,
        Engine: engine,
      };
      if (sampleRate) {
        pollyParams.SampleRate = sampleRate;
      }
      if (speechMarkTypes) {
        pollyParams.SpeechMarkTypes = speechMarkTypes;
      }

      // Call Polly API
      const command = new SynthesizeSpeechCommand(pollyParams);
      const response = await this.polly.send(command);

      // Polly returns response.AudioStream as a Node.js Readable stream.
      // We must consume it into a Buffer in order to know its length.
      const chunks = [];
      for await (const chunk of response.AudioStream) {
        // chunk may be a Buffer or Uint8Array
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const audioBuffer = Buffer.concat(chunks);

      return {
        audioBuffer,             // Buffer containing the audio bytes
        contentType: response.ContentType, // e.g. "audio/mpeg"
        requestCharacters: response.RequestCharacters, // # of chars Polly used
      };
    } catch (error) {
      console.error("Error synthesizing speech:", error);
      throw new Error(`Speech synthesis failed: ${error.message}`);
    }
  }

  /**
   * Synthesizes SSML (no change needed here).
   * @param {string} ssmlText
   * @param {string} voiceId
   * @param {object} options
   * @returns {Promise<{ audioStream: ReadableStream, contentType: string, requestCharacters: number }>}
   */
  async synthesizeSSML(ssmlText, voiceId, options = {}) {
    try {
      const { outputFormat = "mp3", engine = "standard" } = options;
      const pollyParams = {
        Text: ssmlText,
        VoiceId: voiceId,
        OutputFormat: outputFormat,
        Engine: engine,
        TextType: "ssml",
      };
      const command = new SynthesizeSpeechCommand(pollyParams);
      const response = await this.polly.send(command);
      return {
        audioStream: response.AudioStream,
        contentType: response.ContentType,
        requestCharacters: response.RequestCharacters,
      };
    } catch (error) {
      console.error("Error synthesizing SSML:", error);
      throw new Error(`SSML synthesis failed: ${error.message}`);
    }
  }

  /**
   * Estimates how many seconds of audio will result from the given text,
   * assuming ~150 wpm.
   * @param {string} text
   * @param {number} wordsPerMinute
   * @returns {number}
   */
  estimateAudioDuration(text, wordsPerMinute = 150) {
    const wordCount = text.trim().split(/\s+/).length;
    const durationMinutes = wordCount / wordsPerMinute;
    return Math.ceil(durationMinutes * 60); // seconds
  }

  /**
   * Simple text-length validation (no change).
   * @param {string} text
   * @param {number} maxLength
   * @returns {boolean}
   */
  validateTextLength(text, maxLength = 300000) {
    if (text.length > maxLength) {
      throw new Error(`Text exceeds maximum length of ${maxLength} characters`);
    }
    return true;
  }

  /**
   * Looks up a single voice by its ID (no change).
   * @param {string} voiceId
   * @returns {Promise<object|null>}
   */
  async getVoiceById(voiceId) {
    try {
      const voices = await this.getAvailableVoices();
      return voices.find((v) => v.id === voiceId);
    } catch (error) {
      console.error("Error getting voice by ID:", error);
      throw new Error("Failed to validate voice ID");
    }
  }

  /**
   * Calculates character cost (no change).
   * @param {string} text
   * @param {object|null} voice
   * @returns {number}
   */
  calculateCharacterCost(text, voice = null) {
    let baseCharacters = text.length;
    if (
      voice &&
      voice.supportedEngines &&
      voice.supportedEngines.includes("neural")
    ) {
      baseCharacters = Math.ceil(baseCharacters * 1.5);
    }
    return baseCharacters;
  }

  /**
   * Returns supported audio formats (no change).
   */
  getSupportedFormats() {
    return this.supportedFormats;
  }

  /**
   * Returns supported engines (no change).
   */
  getSupportedEngines() {
    return this.supportedEngines;
  }

  /**
   * Placeholder for multi-provider support (no change).
   */
  async synthesizeWithProvider(provider, text, voiceId, options = {}) {
    switch (provider.toLowerCase()) {
      case "polly":
      case "aws":
        return await this.synthesizeText(text, voiceId, options);
      case "google":
        throw new Error("Google TTS not implemented yet");
      case "azure":
        throw new Error("Azure TTS not implemented yet");
      default:
        throw new Error(`Unsupported TTS provider: ${provider}`);
    }
  }
}

module.exports = new TTSService();
