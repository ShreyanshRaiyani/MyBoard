const nodemailer = require("nodemailer");
const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');
require("dotenv").config();

/**
 * Email Notification Service
 * Handles sending email notifications alongside Socket.io real-time notifications
 */

const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Load and compile email templates
let compiledTemplates = {};

function loadTemplate(templateName) {
  if (compiledTemplates[templateName]) {
    return compiledTemplates[templateName];
  }

  try {
    const templatePath = path.join(__dirname, 'emailTemplates', `${templateName}.html`);
    const templateContent = fs.readFileSync(templatePath, 'utf8');
    if (templateContent && templateContent.length) {
      compiledTemplates[templateName] = Handlebars.compile(templateContent);
      return compiledTemplates[templateName];
    }
  } catch (err) {
    console.error(`Could not read/compile email template '${templateName}':`, err.message);
  }
  
  return null;
}

/**
 * Helper function to determine protocol
 */
function getReqProtocol(req) {
  try {
    if (!req) return 'http';
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

/**
 * Helper function to get email image URL
 */
function getEmailImageUrl(req) {
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
  
  return emailImageUrl ? emailImageUrl + '/image' : '';
}

/**
 * Generic function to send notification emails
 * @param {string} email - Recipient email
 * @param {string} templateName - Name of the email template (without .html)
 * @param {object} data - Template data
 * @param {string} subject - Email subject
 * @param {object} req - Express request object (optional, for URL generation)
 */
const sendNotificationEmail = async (email, templateName, data, subject, req = null) => {
  return new Promise((resolve, reject) => {
    try {
      const compiledTemplate = loadTemplate(templateName);
      
      if (!compiledTemplate) {
        console.warn(`Email template '${templateName}' not found. Email not sent.`);
        return reject(new Error(`Template ${templateName} not found`));
      }

      // Prepare template data
      const templateData = {
        ...data,
        emailImageUrl: getEmailImageUrl(req),
      };

      // Render HTML
      let htmlBody;
      try {
        htmlBody = compiledTemplate(templateData);
      } catch (err) {
        console.error(`Error rendering template '${templateName}':`, err.message);
        htmlBody = `<p>Hello ${data.firstName || 'User'},</p><p>${subject}</p>`;
      }

      const mailOptions = {
        from: process.env.SMTP_USER || "myboard71@gmail.com",
        to: email,
        subject: subject,
        html: htmlBody
      };

      // Send email
      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error(`Error sending notification email to ${email}:`, error.message);
          reject(error);
        } else {
          console.log(`Notification email sent to ${email}:`, info.response);
          resolve({
            status: 1,
            message: 'Email sent successfully',
            info: info.response
          });
        }
      });
    } catch (error) {
      console.error('Error in sendNotificationEmail:', error.message);
      reject(error);
    }
  });
};

/**
 * Send Booking Notification Email
 */
const sendBookingNotificationEmail = async (email, bookingData, req = null) => {
  const {
    firstName = 'User',
    notificationTitle = 'New Booking Request',
    notificationMessage = 'You have received a new booking request',
    hoardingName = '',
    bookingNumber = '',
    actionUrl = '',
    actionLabel = 'View Booking'
  } = bookingData;

  return sendNotificationEmail(
    email,
    'bookingNotification',
    {
      firstName,
      notificationTitle,
      notificationMessage,
      hoardingName,
      bookingNumber,
      actionUrl,
      actionLabel
    },
    notificationTitle,
    req
  );
};

/**
 * Send Work Request Notification Email
 */
const sendWorkRequestNotificationEmail = async (email, workRequestData, req = null) => {
  const {
    firstName = 'User',
    notificationTitle = 'New Work Request',
    notificationMessage = 'You have received a new work request',
    requesterName = '',
    workRequestId = '',
    actionUrl = '',
    actionLabel = 'View Request'
  } = workRequestData;

  return sendNotificationEmail(
    email,
    'bookingNotification',
    {
      firstName,
      notificationTitle,
      notificationMessage,
      hoardingName: requesterName,
      bookingNumber: workRequestId,
      actionUrl,
      actionLabel
    },
    notificationTitle,
    req
  );
};

/**
 * Send Payment Notification Email
 */
const sendPaymentNotificationEmail = async (email, paymentData, req = null) => {
  const {
    firstName = 'User',
    notificationTitle = 'Payment Confirmation',
    notificationMessage = 'Your payment has been processed',
    amount = '',
    paymentId = '',
    actionUrl = '',
    actionLabel = 'View Receipt'
  } = paymentData;

  return sendNotificationEmail(
    email,
    'bookingNotification',
    {
      firstName,
      notificationTitle,
      notificationMessage,
      hoardingName: `Amount: ₹${amount}`,
      bookingNumber: paymentId,
      actionUrl,
      actionLabel
    },
    notificationTitle,
    req
  );
};

/**
 * Send Generic System Notification Email
 */
const sendSystemNotificationEmail = async (email, systemData, req = null) => {
  const {
    firstName = 'User',
    notificationTitle = 'System Notification',
    notificationMessage = 'You have received a system notification',
    actionUrl = '',
    actionLabel = 'Go to Dashboard'
  } = systemData;

  return sendNotificationEmail(
    email,
    'bookingNotification',
    {
      firstName,
      notificationTitle,
      notificationMessage,
      actionUrl,
      actionLabel
    },
    notificationTitle,
    req
  );
};

/**
 * Send email to multiple recipients (bulk)
 */
const sendBulkNotificationEmail = async (emails, templateName, data, subject, req = null) => {
  const promises = emails.map(email => 
    sendNotificationEmail(email, templateName, data, subject, req).catch(err => ({
      email,
      success: false,
      error: err.message
    }))
  );

  return Promise.all(promises);
};

/**
 * Test email send
 */
const sendTestEmail = async (email) => {
  const mailOptions = {
    from: process.env.SMTP_USER || "myboard71@gmail.com",
    to: email,
    subject: "Test Email - MyBoard Notification System",
    html: `
      <h1>Test Email</h1>
      <p>This is a test email from MyBoard notification system.</p>
      <p>If you received this email, your email configuration is working correctly!</p>
    `
  };

  return new Promise((resolve, reject) => {
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("Error sending test email:", error);
        reject(error);
      } else {
        console.log("Test email sent successfully:", info.response);
        resolve({
          status: 1,
          message: 'Test email sent successfully',
          info: info.response
        });
      }
    });
  });
};

module.exports = {
  sendNotificationEmail,
  sendBookingNotificationEmail,
  sendWorkRequestNotificationEmail,
  sendPaymentNotificationEmail,
  sendSystemNotificationEmail,
  sendBulkNotificationEmail,
  sendTestEmail,
  getEmailImageUrl
};
