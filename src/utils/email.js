// backend/src/utils/email.js
"use strict";

require("dotenv").config();
const nodemailer = require("nodemailer");

/**
 * Creates and returns a Nodemailer transporter using Gmail SMTP.
 * Make sure your .env contains:
 *   EMAIL_USER=your-gmail-address@gmail.com
 *   EMAIL_PASS=your-gmail-app-password
 */
const createTransporter = () => {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

/**
 * Sends a verification OTP email to a new user.
 * @param {string} email - Recipient's email address.
 * @param {string} otp   - Six‐digit verification code.
 * @param {string} name  - Recipient's full name.
 */
const sendVerificationEmail = async (email, otp, name) => {
  try {
    const transporter = createTransporter();
    const mailOptions = {
      from: `"TTS Platform" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Verify Your Email – TTS Platform",
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Email Verification</title>
          <style>
            body {
              margin: 0;
              padding: 0;
              background-color: #f4f6f8;
              font-family: Arial, sans-serif;
              color: #333333;
            }
            .container {
              max-width: 600px;
              margin: 40px auto;
              background-color: #ffffff;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              overflow: hidden;
            }
            .header {
              background-color: #007bff;
              color: #ffffff;
              text-align: center;
              padding: 20px;
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
            }
            .body {
              padding: 30px;
            }
            .body h2 {
              margin-top: 0;
              color: #007bff;
            }
            .otp-box {
              background-color: #007bff;
              color: #ffffff;
              font-size: 36px;
              letter-spacing: 4px;
              text-align: center;
              padding: 20px;
              border-radius: 6px;
              margin: 30px 0;
              font-weight: bold;
            }
            .footer {
              background-color: #f4f6f8;
              text-align: center;
              padding: 20px;
              font-size: 12px;
              color: #666666;
            }
            a.cta-button {
              display: inline-block;
              text-decoration: none;
              background-color: #28a745;
              color: #ffffff;
              padding: 12px 24px;
              border-radius: 6px;
              margin-top: 20px;
              font-weight: bold;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>TTS Platform</h1>
              <p style="margin: 5px 0; font-size: 14px;">Text-to-Speech Service</p>
            </div>
            <div class="body">
              <h2>Hello, ${name}</h2>
              <p>Thank you for registering on TTS Platform. To complete your registration, please verify your email using the code below. This code will expire in 10 minutes.</p>
              <div class="otp-box">${otp}</div>
              <p>If you did not create an account, please ignore this email.</p>
              <p style="margin-top: 30px;">— The TTS Platform Team</p>
              <p><a class="cta-button" href="#">Verify Email</a></p>
            </div>
            <div class="footer">
              <p>This is an automated email from TTS Platform. Please do not reply.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log("Verification email sent successfully");
  } catch (error) {
    console.error("Error sending verification email:", error);
    throw new Error("Failed to send verification email");
  }
};

/**
 * Sends a password reset OTP email to a user who requested password reset.
 * @param {string} email - Recipient's email address.
 * @param {string} otp   - Six‐digit OTP code for password reset.
 * @param {string} name  - Recipient's full name.
 */
const sendPasswordResetEmail = async (email, otp, name) => {
  try {
    const transporter = createTransporter();
    const mailOptions = {
      from: `"TTS Platform" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Reset Your Password – TTS Platform",
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Password Reset</title>
          <style>
            body {
              margin: 0;
              padding: 0;
              background-color: #f4f6f8;
              font-family: Arial, sans-serif;
              color: #333333;
            }
            .container {
              max-width: 600px;
              margin: 40px auto;
              background-color: #ffffff;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              overflow: hidden;
            }
            .header {
              background-color: #ffc107;
              color: #ffffff;
              text-align: center;
              padding: 20px;
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
            }
            .body {
              padding: 30px;
            }
            .body h2 {
              margin-top: 0;
              color: #dc3545;
            }
            .otp-box {
              background-color: #dc3545;
              color: #ffffff;
              font-size: 36px;
              letter-spacing: 4px;
              text-align: center;
              padding: 20px;
              border-radius: 6px;
              margin: 30px 0;
              font-weight: bold;
            }
            .footer {
              background-color: #f4f6f8;
              text-align: center;
              padding: 20px;
              font-size: 12px;
              color: #666666;
            }
            a.cta-button {
              display: inline-block;
              text-decoration: none;
              background-color: #007bff;
              color: #ffffff;
              padding: 12px 24px;
              border-radius: 6px;
              margin-top: 20px;
              font-weight: bold;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>TTS Platform</h1>
              <p style="margin: 5px 0; font-size: 14px;">Password Reset Request</p>
            </div>
            <div class="body">
              <h2>Hello, ${name}</h2>
              <p>We received a request to reset your password. Use the code below to proceed. This code will expire in 10 minutes.</p>
              <div class="otp-box">${otp}</div>
              <p>If you did not request a password reset, please ignore this email. Your password will remain unchanged.</p>
              <p style="margin-top: 30px;">— The TTS Platform Team</p>
              <p><a class="cta-button" href="#">Reset Password</a></p>
            </div>
            <div class="footer">
              <p>This is an automated email from TTS Platform. Please do not reply.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log("Password reset email sent successfully");
  } catch (error) {
    console.error("Error sending password reset email:", error);
    throw new Error("Failed to send password reset email");
  }
};

/**
 * Sends a welcome email once a user’s email is verified.
 * @param {string} email - Recipient's email address.
 * @param {string} name  - Recipient's full name.
 */
const sendWelcomeEmail = async (email, name) => {
  try {
    const transporter = createTransporter();
    const mailOptions = {
      from: `"TTS Platform" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Welcome to TTS Platform!",
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Welcome!</title>
          <style>
            body {
              margin: 0;
              padding: 0;
              background-color: #f4f6f8;
              font-family: Arial, sans-serif;
              color: #333333;
            }
            .container {
              max-width: 600px;
              margin: 40px auto;
              background-color: #ffffff;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              overflow: hidden;
            }
            .header {
              background-color: #28a745;
              color: #ffffff;
              text-align: center;
              padding: 20px;
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
            }
            .body {
              padding: 30px;
            }
            .body h2 {
              margin-top: 0;
              color: #28a745;
            }
            .features {
              margin: 20px 0;
              padding-left: 0;
              list-style: none;
              line-height: 1.6;
            }
            .features li {
              margin-bottom: 10px;
            }
            .footer {
              background-color: #f4f6f8;
              text-align: center;
              padding: 20px;
              font-size: 12px;
              color: #666666;
            }
            a.cta-button {
              display: inline-block;
              text-decoration: none;
              background-color: #007bff;
              color: #ffffff;
              padding: 12px 24px;
              border-radius: 6px;
              margin-top: 20px;
              font-weight: bold;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to TTS Platform!</h1>
            </div>
            <div class="body">
              <h2>Hello, ${name}</h2>
              <p>Welcome to our Text-to-Speech platform. Your email has been verified successfully!</p>
              <h3 style="color: #333333; margin-top: 20px;">Get Started:</h3>
              <ul class="features">
                <li>🎵 Convert text to speech with high-quality voices</li>
                <li>📁 Download and manage your audio files</li>
                <li>📊 Track your usage and subscription details</li>
                <li>🔧 Integrate our API into your applications</li>
                <li>💬 Access priority support whenever you need it</li>
              </ul>
              <p>Click below to log in to your dashboard:</p>
              <p><a class="cta-button" href="#">Go to Dashboard</a></p>
              <p style="margin-top: 30px;">— The TTS Platform Team</p>
            </div>
            <div class="footer">
              <p>This is an automated email from TTS Platform. Please do not reply.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log("Welcome email sent successfully");
  } catch (error) {
    console.error("Error sending welcome email:", error);
    throw new Error("Failed to send welcome email");
  }
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail
};
