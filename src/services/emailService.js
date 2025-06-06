// backend/src/utils/email.js
"use strict";

require("dotenv").config(); // Load EMAIL_USER and EMAIL_PASS from .env

const nodemailer = require("nodemailer");

class EmailService {
  constructor() {
    // Create the transporter using nodemailer.createTransport(...)
    this.transporter = this.createTransporter();
  }

  createTransporter() {
    return nodemailer.createTransport({
      service: "gmail", // or your email provider
      auth: {
        user: process.env.EMAIL_USER, // e.g. your-gmail-address@gmail.com
        pass: process.env.EMAIL_PASS  // e.g. App Password for Gmail
      }
    });
  }

  async sendEmail(to, subject, htmlContent, textContent = null) {
    try {
      const mailOptions = {
        from: `"TTS Platform" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        html: htmlContent,
        text: textContent
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log("Email sent successfully:", result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error("Error sending email:", error);
      throw new Error("Failed to send email");
    }
  }

  async sendVerificationEmail(email, otp, name) {
    const subject = "Verify Your Email ‐ TTS Platform";
    const htmlContent = `
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
            width: 100%;
            max-width: 600px;
            margin: 40px auto;
            background-color: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
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
            <p>Thank you for registering on TTS Platform. To complete your registration, please verify your email using the verification code below. This code will expire in 10 minutes.</p>
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
    `;

    return await this.sendEmail(email, subject, htmlContent);
  }

  async sendPasswordResetEmail(email, otp, name) {
    const subject = "Reset Your Password ‐ TTS Platform";
    const htmlContent = `
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
            width: 100%;
            max-width: 600px;
            margin: 40px auto;
            background-color: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
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
            <p>We received a request to reset your password. Use the verification code below to proceed. This code will expire in 10 minutes.</p>
            <div class="otp-box">${otp}</div>
            <p>If you did not request a password reset, please ignore this email. Your password will remain secure.</p>
            <p style="margin-top: 30px;">— The TTS Platform Team</p>
            <p><a class="cta-button" href="#">Reset Password</a></p>
          </div>
          <div class="footer">
            <p>This is an automated email from TTS Platform. Please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail(email, subject, htmlContent);
  }

  async sendWelcomeEmail(email, name) {
    const subject = "Welcome to TTS Platform!";
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Welcome to TTS Platform</title>
        <style>
          body {
            margin: 0;
            padding: 0;
            background-color: #f4f6f8;
            font-family: Arial, sans-serif;
            color: #333333;
          }
          .container {
            width: 100%;
            max-width: 600px;
            margin: 40px auto;
            background-color: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
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
            list-style: none;
            padding-left: 0;
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
            <p>Thank you for verifying your email and joining TTS Platform. We’re excited to have you on board!</p>
            <h3 style="color: #333333; margin-top: 20px;">Here’s what you can do next:</h3>
            <ul class="features">
              <li>🎵 Convert text to speech using high-quality voices</li>
              <li>📁 Download and manage your audio files</li>
              <li>📊 Track your usage and subscription details</li>
              <li>🔧 Integrate our API into your applications</li>
              <li>💬 Access priority support whenever you need it</li>
            </ul>
            <p>Get started by logging into your dashboard:</p>
            <p><a class="cta-button" href="#">Go to Dashboard</a></p>
            <p style="margin-top: 30px;">— The TTS Platform Team</p>
          </div>
          <div class="footer">
            <p>This is an automated email from TTS Platform. Please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail(email, subject, htmlContent);
  }

  async sendSubscriptionApprovalEmail(email, name, planName, endDate) {
    const subject = "Your Subscription Is Active ‐ TTS Platform";
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Subscription Approved</title>
        <style>
          body {
            margin: 0;
            padding: 0;
            background-color: #f4f6f8;
            font-family: Arial, sans-serif;
            color: #333333;
          }
          .container {
            width: 100%;
            max-width: 600px;
            margin: 40px auto;
            background-color: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .header {
            background-color: #17a2b8;
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
            color: #17a2b8;
          }
          .details-box {
            background-color: #ffffff;
            border: 1px solid #17a2b8;
            border-radius: 6px;
            padding: 20px;
            margin: 20px 0;
          }
          .details-box p {
            margin: 5px 0;
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
            <h1>Subscription Approved</h1>
          </div>
          <div class="body">
            <h2>Hello, ${name}</h2>
            <p>Congratulations! Your subscription payment has been verified and approved.</p>
            <div class="details-box">
              <h4 style="margin-top: 0; color: #17a2b8;">Subscription Details:</h4>
              <p><strong>Plan:</strong> ${planName}</p>
              <p><strong>Status:</strong> Active</p>
              <p><strong>Valid Until:</strong> ${new Date(endDate).toLocaleDateString()}</p>
            </div>
            <p>You can now enjoy all the features included in your plan. Log in to your dashboard to begin using our text-to-speech services!</p>
            <p><a class="cta-button" href="#">Go to Dashboard</a></p>
            <p style="margin-top: 30px;">— The TTS Platform Team</p>
          </div>
          <div class="footer">
            <p>This is an automated email from TTS Platform. Please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail(email, subject, htmlContent);
  }
}

module.exports = new EmailService();
