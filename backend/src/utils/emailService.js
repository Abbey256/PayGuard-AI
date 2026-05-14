import dotenv from 'dotenv';
import { Resend } from 'resend';

dotenv.config();

class EmailService {
  constructor() {
    if (!process.env.RESEND_API_KEY) {
      console.error("❌ RESEND_API_KEY is missing from environment variables!");
    } else {
      const maskedKey = process.env.RESEND_API_KEY.substring(0, 7) + "..." + process.env.RESEND_API_KEY.slice(-4);
      console.log(`📡 EmailService initialized with key: ${maskedKey}`);
    }
    this.resend = new Resend(process.env.RESEND_API_KEY);
  }

  async sendVerificationEmail(employee) {
    try {
      const apiKey = process.env.RESEND_API_KEY;
      if (!apiKey) {
        console.error("❌ RESEND_API_KEY is missing during send attempt!");
      } else {
        const maskedKey = apiKey.substring(0, 7) + "..." + apiKey.slice(-4);
        console.log(`📡 Attempting to send email with key: ${maskedKey}`);
      }
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const verificationLink = `${frontendUrl}/verify/${employee.verification_token}`;

      const { data, error } = await this.resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'PayGuard AI <onboarding@resend.dev>',
        to: employee.email,
        subject: "PayGuard AI - Proof of Life Verification Required",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1f2937;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h2 style="color: #16a34a; font-size: 28px; margin: 0;">PayGuard AI</h2>
              <p style="color: #6b7280; margin-top: 5px;">Government Payroll Verification System</p>
            </div>

            <p>Dear <strong>${employee.full_name}</strong>,</p>
            <p>As part of the ongoing government payroll verification exercise, you are required to complete your 
            <strong>Proof of Life</strong> verification to ensure uninterrupted salary payment.</p>
            
            <div style="background-color: #f0fdf4; padding: 30px; border-radius: 16px; text-align: center; margin: 30px 0; border: 1px solid #dcfce7;">
              <h3 style="margin-top: 0; color: #166534;">Identity Verification Required</h3>
              <p style="font-size: 14px; color: #166534; margin-bottom: 25px;">Please click the button below to start your biometric and document verification process.</p>
              <a href="${verificationLink}" 
                 style="background-color: #16a34a; color: white; padding: 16px 32px; text-decoration: none; 
                        border-radius: 12px; display: inline-block; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                START VERIFICATION
              </a>
            </div>
            
            <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 15px; margin: 25px 0;">
              <p style="margin: 0; font-size: 13px; color: #92400e;">
                <strong>Important Instructions:</strong>
              </p>
              <ul style="margin: 10px 0 0 0; padding-left: 20px; font-size: 13px; color: #92400e;">
                <li>This link will expire in <strong>3 days</strong>.</li>
                <li>You have <strong>3 attempts</strong> to complete the verification.</li>
                <li>Ensure you are in a well-lit area for the biometric scan.</li>
              </ul>
            </div>

            <p style="font-size: 12px; color: #9ca3af; text-align: center; margin-top: 40px;">
              &copy; 2026 PayGuard AI. This is an automated message from the Ministry Payroll Security Department.
            </p>
          </div>
        `
      });

      if (error) throw error;

      return { success: true };

    } catch (error) {
      console.error(`❌ Failed to send email to ${employee.email}:`, error.message);
      return { success: false, error: error.message };
    }
  }
}

export default new EmailService();