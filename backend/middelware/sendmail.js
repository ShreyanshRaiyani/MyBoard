const nodemailer = require("nodemailer");
const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');
require("dotenv").config();

// Note: If process.env.EMAIL_IMAGE_URL is not set, callers can pass the current
// Express `req` object as the last argument to email functions so we can build
// a base URL from the request (e.g. http://host:port). If neither is present,
// the template will receive an empty string.


const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Load template once at module load time. If missing, templateContent will be empty.
let templateContent = '';
let compiledTemplate = null;
try {
  const templatePath = path.join(__dirname, 'emailTemplates', 'resetPassword.html');
  templateContent = fs.readFileSync(templatePath, 'utf8');
  if (templateContent && templateContent.length) {
    compiledTemplate = Handlebars.compile(templateContent);
  }
} catch (err) {
  console.error('Could not read/compile email template for reset password:', err && err.message ? err.message : err);
}

// Compile additional templates ( partner created, purchase plan)
let compiledPartnerTemplate = null;
let compiledPurchaseTemplate = null;
try {
  const partnerPath = path.join(__dirname, 'emailTemplates', 'ordermanageCreated.html');
  const partnerContent = fs.readFileSync(partnerPath, 'utf8');
  if (partnerContent && partnerContent.length) {
    compiledPartnerTemplate = Handlebars.compile(partnerContent);
  }
} catch (err) {
  console.error('Could not read/compile email template for partner:', err && err.message ? err.message : err);
}

function getReqProtocol(req) {
  try {
    if (!req) return 'http';
    // try common header names
    if (typeof req.get === 'function') {
      const forwarded = req.get('x-forwarded-proto') || req.get('X-Forwarded-Proto') || '';
      if (forwarded && forwarded.length) {
        return forwarded.split(',')[0].trim().toLowerCase();
      }
    }
    if (req.protocol) return String(req.protocol).toLowerCase();
  } catch (e) {
    // fall through
  }
  return 'http';
}

function sendResetPasswordEmail(email, otp, verification, user, req) {
  const firstName = user && user.firstName ? user.firstName : '';

  
  // Compute emailImageUrl: prefer request-derived host, otherwise fall back to APP_BASE_URL
  // We intentionally do NOT use EMAIL_IMAGE_URL here per project decision.
  let emailImageUrl = '';

  const protocol = getReqProtocol(req);
  console.log("Request protocol in sendResetPasswordEmail:", protocol);
  if (req && typeof req.get === 'function') {
    try {
      emailImageUrl = `${protocol}://${req.get('host')}`;
    } catch (e) {
      emailImageUrl = '';
    }
  } else if (process.env.APP_BASE_URL && process.env.APP_BASE_URL.length) {
    emailImageUrl = process.env.APP_BASE_URL.replace(/\/$/, '');
    
  }
    emailImageUrl = emailImageUrl + '/image';
  const data = {
    emailImageUrl,
    firstName,
    otp: String(otp),
    verification,
    user
  };

  let htmlBody;
  if (compiledTemplate) {
    try {
      htmlBody = compiledTemplate(data);
    } catch (err) {
      console.error('Error rendering email template:', err && err.message ? err.message : err);
      htmlBody = `<p>Hello ${firstName},</p><p>Your OTP is <strong>${otp}</strong></p>`;
    }
  } else {
    htmlBody = `<p>Hello ${firstName},</p><p>Your OTP is <strong>${otp}</strong></p>`;
  }

  const mailOptions = {
    from: "community.innoveza@gmail.com",
    to: email,
    subject: "Email Confirmation OTP",
    html: htmlBody
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error("Error sending email:", error);
    } else {
      console.log("Email sent:", info.response);
      console.log("To:", email);
      console.log("OTP sent:", otp);
    }
  });
}

function sendOderManagementCreatedEmail(email,  user, req) {
  const firstName = user && user.firstName ? user.firstName : '';
  // Compute emailImageUrl: prefer request-derived host, otherwise fall back to APP_BASE_URL
  // We intentionally do NOT use EMAIL_IMAGE_URL here per project decision.
  let emailImageUrl = '';
  const protocol = getReqProtocol(req);
  if (req && typeof req.get === 'function') {
    try {
      emailImageUrl = `${protocol}://${req.get('host')}`;
    } catch (e) {
      emailImageUrl = '';
    }
  } else if (process.env.APP_BASE_URL && process.env.APP_BASE_URL.length) {
    emailImageUrl = process.env.APP_BASE_URL.replace(/\/$/, '');
  }
  emailImageUrl = emailImageUrl + '/image';

  console.log("Email image URL:", emailImageUrl);
  const data = {
    emailImageUrl,
    firstName,
    partner:user,
  };
  console.log("Data for partner email template:", data);
  let htmlBody;
  if (compiledPartnerTemplate) {
    try {
      htmlBody = compiledPartnerTemplate(data);
    } catch (err) {
      console.error('Error rendering partner email template:', err && err.message ? err.message : err);
      htmlBody = `<p>Hello ${firstName},</p><p>New partner created: ${user && user.name ? user.name : ''}</p>`;
    }
  } else {
    htmlBody = `<p>Hello ${firstName},</p><p>New partner created: ${user && user.name ? user.name : ''}</p>`;
  }

  const mailOptions = {
    from: "community.innoveza@gmail.com",
    to: email,
    subject: "New Partner Created",
    html: htmlBody
  };
console.log("Mail options for partner email:", mailOptions);
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error("Error sending partner email:", error);
    } else {
      console.log("Partner email sent:", info.response);
      console.log("To:", email);
    }
  });
}

function sendPurchasePlanEmail(email, plan, user, payment, req) {
  const firstName = user && user.firstName ? user.firstName : '';
  // Compute emailImageUrl: prefer request-derived host, otherwise fall back to APP_BASE_URL
  // We intentionally do NOT use EMAIL_IMAGE_URL here per project decision.
  let emailImageUrl = '';
  const protocol = getReqProtocol(req);
  if (req && typeof req.get === 'function') {
    try {
      emailImageUrl = `${protocol}://${req.get('host')}`;
    } catch (e) {
      emailImageUrl = '';
    }
  } else if (process.env.APP_BASE_URL && process.env.APP_BASE_URL.length) {
    emailImageUrl = process.env.APP_BASE_URL.replace(/\/$/, '');
  }
  emailImageUrl = emailImageUrl + '/image';
  const data = {
    emailImageUrl,
    firstName,
    plan,
    payment
  };

  let htmlBody;
  if (compiledPurchaseTemplate) {
    try {
      htmlBody = compiledPurchaseTemplate(data);
    } catch (err) {
      console.error('Error rendering purchase plan template:', err && err.message ? err.message : err);
      htmlBody = `<p>Hello ${firstName},</p><p>Your purchase for ${plan && plan.name ? plan.name : ''} of amount ${payment && payment.amount ? payment.amount : ''} was successful.</p>`;
    }
  } else {
    htmlBody = `<p>Hello ${firstName},</p><p>Your purchase for ${plan && plan.name ? plan.name : ''} of amount ${payment && payment.amount ? payment.amount : ''} was successful.</p>`;
  }

  const mailOptions = {
    from: "community.innoveza@gmail.com",
    to: email,
    subject: "Plan Purchase Confirmation",
    html: htmlBody
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error("Error sending purchase email:", error);
    } else {
      console.log("Purchase email sent:", info.response);
      console.log("To:", email);
    }
  });
}

module.exports = {
  sendResetPasswordEmail,
  sendOderManagementCreatedEmail,
  sendPurchasePlanEmail
};