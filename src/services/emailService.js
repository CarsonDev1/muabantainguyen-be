'use strict';

import 'dotenv/config';
import nodemailer from 'nodemailer';

// Sử dụng port 465 với SSL như GMass
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Hoặc thử cấu hình đơn giản với service
// const transporter = nodemailer.createTransporter({
//   service: 'gmail',
//   auth: {
//     user: process.env.SMTP_USER,
//     pass: process.env.SMTP_PASS
//   }
// });

export async function sendPasswordResetEmail(email, resetToken) {
  const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;

  const mailOptions = {
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: 'Đặt lại mật khẩu - Muabantainguyen',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Đặt lại mật khẩu</h2>
        <p>Xin chào,</p>
        <p>Bạn đã yêu cầu đặt lại mật khẩu cho tài khoản của mình.</p>
        <p>Nhấp vào liên kết bên dưới để đặt lại mật khẩu:</p>
        <a href="${resetUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Đặt lại mật khẩu</a>
        <p>Liên kết này sẽ hết hạn sau 1 giờ.</p>
        <p>Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.</p>
        <hr style="margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">Email này được gửi tự động từ hệ thống Muabantainguyen.</p>
      </div>
    `
  };

  try {
    console.log('Attempting to send email to:', email);
    console.log('Using SMTP_USER:', process.env.SMTP_USER);
    console.log('SMTP_PASS length:', process.env.SMTP_PASS?.length);

    // Test connection trước
    await transporter.verify();
    console.log('SMTP connection verified successfully');

    const result = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', result.messageId);
    return true;
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    console.error('Error code:', error.code);
    console.error('Error command:', error.command);

    // Log thêm thông tin debug
    if (error.responseCode) {
      console.error('Response code:', error.responseCode);
    }
    if (error.response) {
      console.error('Response:', error.response);
    }

    throw new Error(`Failed to send email: ${error.message}`);
  }
}

export async function sendWelcomeEmail(email, name) {
  const mailOptions = {
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: 'Chào mừng đến với Muabantainguyen!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Chào mừng ${name}!</h2>
        <p>Cảm ơn bạn đã đăng ký tài khoản tại Muabantainguyen.</p>
        <p>Bây giờ bạn có thể:</p>
        <ul>
          <li>Mua sắm các sản phẩm digital</li>
          <li>Theo dõi đơn hàng</li>
          <li>Quản lý tài khoản</li>
        </ul>
        <p>Chúc bạn có trải nghiệm mua sắm tuyệt vời!</p>
        <hr style="margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">Email này được gửi tự động từ hệ thống Muabantainguyen.</p>
      </div>
    `
  };

  try {
    await transporter.verify();
    const result = await transporter.sendMail(mailOptions);
    console.log('Welcome email sent successfully:', result.messageId);
    return true;
  } catch (error) {
    console.error('Failed to send welcome email:', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
}