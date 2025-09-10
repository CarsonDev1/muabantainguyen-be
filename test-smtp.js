import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

dotenv.config();

async function testSMTP() {
  console.log('🔧 Testing SMTP connection...');
  console.log('SMTP_USER:', process.env.SMTP_USER);
  console.log('SMTP_PASS:', process.env.SMTP_PASS ? `${process.env.SMTP_PASS.substring(0, 4)}****` : 'UNDEFINED');

  const transporter = nodemailer.createTransporter({
    service: 'gmail',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  try {
    console.log('📧 Verifying SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection verified successfully!');

    console.log('�� Sending test email...');
    const result = await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: process.env.SMTP_USER,
      subject: 'Test Email from Muabantainguyen',
      text: 'This is a test email to verify SMTP configuration.'
    });

    console.log('✅ Test email sent successfully!');
    console.log('Message ID:', result.messageId);
  } catch (error) {
    console.error('❌ SMTP test failed:', error.message);
    console.error('Error code:', error.code);
    console.error('Error command:', error.command);
  }
}

testSMTP();
