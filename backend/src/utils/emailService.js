// utils/emailService.js
const dotenv = require('dotenv');
const nodemailer = require('nodemailer');

dotenv.config();   // ← Must be at the top

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD
      }
    });
  }

  async sendVerificationEmail(employee) {
    try {
      const verificationLink = `http://localhost:3000/verify/${employee.verification_token}`;

      const mailOptions = {
        from: `"PayGuard AI" <${process.env.EMAIL_USER}>`,
        to: employee.email,
        subject: "PayGuard AI - Proof of Life Verification Required",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1e40af;">PayGuard AI - Employment Verification</h2>
            <p>Dear <strong>${employee.full_name}</strong>,</p>
            <p>As part of the government payroll verification exercise, you are required to complete your 
            <strong>Proof of Life</strong> verification.</p>
            
            <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
              <h3>Please verify your identity</h3>
              <a href="${verificationLink}" 
                 style="background-color: #1e40af; color: white; padding: 14px 28px; text-decoration: none; 
                        border-radius: 6px; display: inline-block; font-weight: bold;">
                VERIFY NOW
              </a>
            </div>
            
            <p><strong>Important:</strong></p>
            <ul>
              <li>This link will expire in <strong>3 days</strong>.</li>
              <li>You have <strong>3 attempts</strong> to verify successfully.</li>
              <li>If you fail after 3 attempts, contact HR for manual verification.</li>
            </ul>
          </div>
        `
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`✅ Email sent to ${employee.email}`);
      return { success: true };

    } catch (error) {
      console.error(`❌ Failed to send email to ${employee.email}:`, error.message);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new EmailService();