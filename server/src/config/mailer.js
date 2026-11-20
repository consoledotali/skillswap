import nodemailer from "nodemailer";

function clientUrl() {
  return process.env.CLIENT_URL || "http://localhost:5173";
}

function hasSmtp() {
  return Boolean(
    (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD) ||
    (process.env.SMTP_USER && process.env.SMTP_PASSWORD)
  );
}

let transporter = null;

function getTransporter() {
  if (!hasSmtp()) return null;
  if (!transporter) {
    const isGmail =
      process.env.SMTP_SERVICE === "gmail" ||
      (process.env.SMTP_HOST && process.env.SMTP_HOST.includes("gmail")) ||
      (process.env.SMTP_USER && process.env.SMTP_USER.includes("@gmail.com"));

    if (isGmail) {
      transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        },
      });
    } else {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.gmail.com",
        port: Number(process.env.SMTP_PORT || 587),
        secure: String(process.env.SMTP_SECURE || "false") === "true",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        },
      });
    }
  }
  return transporter;
}

function emailWrapper({ title, preview, contentHtml }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    .email-container { max-width: 540px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08); border: 1px solid #e2e8f0; }
    .email-header { background: linear-gradient(135deg, #2563eb, #4f46e5); padding: 36px 32px 30px; text-align: center; }
    .email-logo { font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; margin: 0; }
    .email-logo span { color: #93c5fd; }
    .email-tagline { color: #e0e7ff; font-size: 13px; margin-top: 6px; font-weight: 500; }
    .email-body { padding: 36px 32px; color: #1e293b; line-height: 1.6; }
    .email-title { font-size: 20px; font-weight: 700; color: #0f172a; margin: 0 0 14px; text-align: center; }
    .email-text { font-size: 15px; color: #475569; margin: 0 0 24px; text-align: center; }
    .otp-box { background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 12px; padding: 22px; text-align: center; margin: 24px 0; }
    .otp-code { font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 800; letter-spacing: 9px; color: #2563eb; margin: 0; padding-left: 9px; }
    .otp-expiry { font-size: 12px; color: #64748b; margin-top: 8px; font-weight: 500; }
    .btn-link { display: inline-block; background: #2563eb; color: #ffffff !important; font-weight: 600; font-size: 14px; text-decoration: none; padding: 12px 28px; border-radius: 8px; margin: 18px 0; text-align: center; }
    .email-footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 32px; text-align: center; font-size: 12px; color: #94a3b8; line-height: 1.5; }
  </style>
</head>
<body>
  <div style="display:none;font-size:1px;color:#333;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
    ${preview}
  </div>
  <div class="email-container">
    <div class="email-header">
      <h1 class="email-logo">Skill<span>Swap</span></h1>
      <div class="email-tagline">Pakistan's Peer-to-Peer Skill Community</div>
    </div>
    <div class="email-body">
      ${contentHtml}
    </div>
    <div class="email-footer">
      This is an automated security message from SkillSwap.<br>
      Please do not reply directly to this email.
    </div>
  </div>
</body>
</html>`;
}

async function sendMail({ to, subject, text, html, otp, link, purpose }) {
  const transport = getTransporter();

  if (!transport) {
    console.info(`
╔══════════════════════════════════════════════════════════════════════════════╗
║ [SKILLSWAP DEV EMAIL - SMTP NOT CONFIGURED]                                  ║
║ Purpose: ${purpose || "Security"}                                            
║ To:      ${to}                                                               
║ OTP:     ${otp || "N/A"}                                                     
║ Link:    ${link || "N/A"}                                                    
╚══════════════════════════════════════════════════════════════════════════════╝`);
    return { development: true, devOtp: otp };
  }

  const info = await transport.sendMail({
    from: process.env.SMTP_FROM || `"SkillSwap" <${process.env.SMTP_USER}>`,
    to,
    subject,
    text,
    html,
  });

  return { success: true, messageId: info.messageId };
}

async function sendVerificationEmail(user, otp) {
  const link = `${clientUrl()}/verify-email?email=${encodeURIComponent(user.email)}&otp=${encodeURIComponent(otp)}`;
  const subject = `${otp} is your SkillSwap verification code`;
  const text = `Welcome to SkillSwap, ${user.full_name || "there"}!\n\nYour 6-digit verification code is: ${otp}\n\nThis code will expire in 15 minutes.\n\nOr click here to verify automatically: ${link}`;

  const html = emailWrapper({
    title: "Verify your SkillSwap email",
    preview: `Your 6-digit verification code is ${otp}. Valid for 15 minutes.`,
    contentHtml: `
      <h2 class="email-title">Verify your Email Address</h2>
      <p class="email-text">
        Welcome to SkillSwap, <b>${user.full_name || "Learner"}</b>! Use the 6-digit verification code below to activate your account.
      </p>
      <div class="otp-box">
        <div class="otp-code">${otp}</div>
        <div class="otp-expiry">Expires in 15 minutes • Do not share this code</div>
      </div>
      <div style="text-align:center;">
        <p style="font-size:13px; color:#64748b; margin-bottom: 6px;">Or click the button below to verify instantly:</p>
        <a href="${link}" class="btn-link" target="_blank">Verify Email Instantly</a>
      </div>
      <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-top: 24px;">
        If you did not register for SkillSwap, please safely ignore this email.
      </p>
    `,
  });

  return sendMail({
    to: user.email,
    subject,
    text,
    html,
    otp,
    link,
    purpose: "Email Verification",
  });
}

async function sendPasswordResetEmail(user, otp) {
  const link = `${clientUrl()}/reset-password?email=${encodeURIComponent(user.email)}&otp=${encodeURIComponent(otp)}`;
  const subject = `${otp} is your SkillSwap password reset code`;
  const text = `Hello ${user.full_name || "there"},\n\nWe received a request to reset your SkillSwap password.\n\nYour 6-digit reset code is: ${otp}\n\nThis code will expire in 15 minutes.\n\nOr click here to reset your password: ${link}`;

  const html = emailWrapper({
    title: "Reset your SkillSwap password",
    preview: `Your password reset code is ${otp}. Valid for 15 minutes.`,
    contentHtml: `
      <h2 class="email-title">Password Reset Request</h2>
      <p class="email-text">
        Hello <b>${user.full_name || "User"}</b>, we received a request to reset the password for your SkillSwap account.
      </p>
      <div class="otp-box">
        <div class="otp-code">${otp}</div>
        <div class="otp-expiry">Expires in 15 minutes • Keep this confidential</div>
      </div>
      <div style="text-align:center;">
        <p style="font-size:13px; color:#64748b; margin-bottom: 6px;">Or click below to set a new password directly:</p>
        <a href="${link}" class="btn-link" target="_blank">Reset Password Now</a>
      </div>
      <p style="font-size: 12px; color: #e11d48; text-align: center; margin-top: 24px; font-weight: 500;">
        If you did not request a password reset, your account is still secure and you can ignore this email.
      </p>
    `,
  });

  return sendMail({
    to: user.email,
    subject,
    text,
    html,
    otp,
    link,
    purpose: "Password Reset",
  });
}

export { sendVerificationEmail, sendPasswordResetEmail };

