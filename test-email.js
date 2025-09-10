import 'dotenv/config';
import { sendPasswordResetEmail } from './src/services/emailService.js';

async function testEmail() {
  try {
    console.log('🔧 Testing email configuration...');
    console.log('SMTP_HOST:', process.env.SMTP_HOST);
    console.log('SMTP_USER:', process.env.SMTP_USER);
    console.log('SMTP_PASS:', process.env.SMTP_PASS ? `${process.env.SMTP_PASS.substring(0, 4)}****` : 'UNDEFINED');
    console.log('CLIENT_URL:', process.env.CLIENT_URL);

    if (!process.env.SMTP_PASS) {
      console.error('❌ SMTP_PASS is not defined in .env file!');
      return;
    }

    console.log('📧 Sending test email...');
    await sendPasswordResetEmail('buitritinht@gmail.com', 'test-token-123');
    console.log('✅ Email sent successfully!');
  } catch (error) {
    console.error('❌ Email failed:', error.message);
    console.error('Full error:', error);
  }
}

testEmail();
