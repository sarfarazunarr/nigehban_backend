const nodemailer = require('nodemailer');

const createTransporter = () => {
  const isMock = process.env.SMTP_USER === 'mock_user' || !process.env.SMTP_USER;

  if (isMock) {
    console.log('Using mock mail transporter (logs to console).');
    return {
      sendMail: async (mailOptions) => {
        console.log('\n--- MOCK EMAIL SENT ---');
        console.log(`To: ${mailOptions.to}`);
        console.log(`From: ${mailOptions.from}`);
        console.log(`Subject: ${mailOptions.subject}`);
        console.log(`Body:\n${mailOptions.text || mailOptions.html}`);
        console.log('-----------------------\n');
        return { messageId: 'mock-id-123456' };
      }
    };
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.mailtrap.io',
    port: parseInt(process.env.SMTP_PORT || '2525', 10),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

const transporter = createTransporter();

const sendResetEmail = async (email, resetUrl) => {
  const mailOptions = {
    from: process.env.FROM_EMAIL || 'noreply@nigehbaan.gov.pk',
    to: email,
    subject: 'Password Reset Request - Nigehbaan',
    text: `You are receiving this email because you (or someone else) have requested the reset of a password. Please click on the following link or paste it into your browser to complete the process:\n\n${resetUrl}\n\nIf you did not request this, please ignore this email.`,
    html: `
      <h3>Nigehbaan - Password Reset Request</h3>
      <p>You requested a password reset. Click the button below to set a new password. The link is valid for 10 minutes.</p>
      <a href="${resetUrl}" style="background-color: #e21c3d; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
      <br/><br/>
      <p>If you cannot click the button, copy and paste the link below into your browser:</p>
      <p>${resetUrl}</p>
    `
  };

  return await transporter.sendMail(mailOptions);
};

module.exports = {
  sendResetEmail
};
