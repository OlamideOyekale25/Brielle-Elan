const sgMail = require('@sendgrid/mail');

// Initialize SendGrid API key from environment (do NOT hard-code secrets)
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || '';
const FROM_EMAIL = process.env.FROM_EMAIL || '';
const TO_EMAIL = process.env.TO_EMAIL || '';

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

exports.handler = async function (event, context) {
  // Add CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*', // Change to your domain in production
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  // Allow only POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { ...corsHeaders, 'Allow': 'POST' },
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  if (!SENDGRID_API_KEY || !FROM_EMAIL) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: 'SendGrid not configured. Set SENDGRID_API_KEY and FROM_EMAIL environment variables.' 
      })
    };
  }

  let data;
  try {
    data = JSON.parse(event.body);
  } catch (err) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Invalid JSON' })
    };
  }

  // Honeypot check
  if (data['bot-field']) {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ success: true })
    };
  }

  // Validate required fields
  const requiredFields = ['name', 'email', 'phone', 'service', 'date', 'time'];
  const missingFields = requiredFields.filter(field => !data[field] || data[field].trim() === '');
  
  if (missingFields.length > 0) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: 'Missing required fields', 
        fields: missingFields 
      })
    };
  }

  // Extract and validate form data
  const name = data.name.trim();
  const email = data.email.trim();
  const phone = data.phone.trim();
  const service = data.service.trim();
  const date = data.date.trim();
  const time = data.time.trim();
  const message = data.message ? data.message.trim() : '';

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Invalid email format' })
    };
  }

  // Format date for better readability
  let formattedDate = date;
  try {
    const dateObj = new Date(date);
    formattedDate = dateObj.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch (e) {
    // Keep original date if parsing fails
  }

  // Format time for better readability
  let formattedTime = time;
  try {
    const [hours, minutes] = time.split(':');
    const timeObj = new Date();
    timeObj.setHours(parseInt(hours), parseInt(minutes));
    formattedTime = timeObj.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  } catch (e) {
    // Keep original time if parsing fails
  }

  // =================================================================
  // EMAIL 1: Notification to YOU (the business owner)
  // =================================================================
  const adminHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333; border-bottom: 2px solid #000; padding-bottom: 10px;">
        New Consultation Booking Request
      </h2>
      
      <div style="background: #f9f9f9; padding: 20px; margin: 20px 0; border-radius: 8px;">
        <h3 style="color: #333; margin-top: 0;">Client Information</h3>
        <p><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Phone:</strong> ${escapeHtml(phone)}</p>
      </div>

      <div style="background: #f0f0f0; padding: 20px; margin: 20px 0; border-radius: 8px;">
        <h3 style="color: #333; margin-top: 0;">Appointment Details</h3>
        <p><strong>Service:</strong> ${escapeHtml(service)}</p>
        <p><strong>Requested Date:</strong> ${escapeHtml(formattedDate)}</p>
        <p><strong>Requested Time:</strong> ${escapeHtml(formattedTime)}</p>
      </div>

      ${message ? `
      <div style="background: #f9f9f9; padding: 20px; margin: 20px 0; border-radius: 8px;">
        <h3 style="color: #333; margin-top: 0;">Additional Message</h3>
        <p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>
      </div>
      ` : ''}

      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
        <p style="color: #666; font-size: 12px;">
          This booking request was submitted through the Brielle Élan consultation form.
        </p>
      </div>
    </div>
  `;

  const adminTextContent = `
NEW CONSULTATION BOOKING REQUEST

Client Information:
Name: ${name}
Email: ${email}
Phone: ${phone}

Appointment Details:
Service: ${service}
Requested Date: ${formattedDate}
Requested Time: ${formattedTime}

${message ? `Additional Message:\n${message}\n` : ''}

---
This booking request was submitted through the Brielle Élan consultation form.
  `;

  const adminEmail = {
    to: TO_EMAIL,
    from: FROM_EMAIL,
    subject: `[Consultation Request] ${name} - ${service}`,
    text: adminTextContent,
    html: adminHtml
  };

  // =================================================================
  // EMAIL 2: Confirmation to CUSTOMER
  // =================================================================
  const customerHtml = `
    <div style="font-family: 'Georgia', serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
      <!-- Header with brand -->
      <div style="background: #000000; padding: 30px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 28px; letter-spacing: 2px;">BRIELLE ÉLAN</h1>
      </div>

      <!-- Main content -->
      <div style="padding: 40px 30px;">
        <h2 style="color: #000000; font-size: 24px; margin-bottom: 20px;">Thank You for Your Booking Request!</h2>
        
        <p style="color: #333; font-size: 16px; line-height: 1.6;">
          Dear ${escapeHtml(name)},
        </p>
        
        <p style="color: #333; font-size: 16px; line-height: 1.6;">
          We have received your consultation request and are excited to meet with you! Your appointment has been scheduled for:
        </p>

        <!-- Appointment details box -->
        <div style="background: #f8f8f8; border-left: 4px solid #000000; padding: 25px; margin: 30px 0;">
          <p style="margin: 0 0 15px 0; color: #333;">
            <strong style="color: #000;">Service:</strong><br>
            <span style="font-size: 18px;">${escapeHtml(service)}</span>
          </p>
          <p style="margin: 0 0 15px 0; color: #333;">
            <strong style="color: #000;">Date:</strong><br>
            <span style="font-size: 18px;">${escapeHtml(formattedDate)}</span>
          </p>
          <p style="margin: 0; color: #333;">
            <strong style="color: #000;">Time:</strong><br>
            <span style="font-size: 18px;">${escapeHtml(formattedTime)}</span>
          </p>
        </div>

        <div style="background: #fff9e6; border: 1px solid #f0e5c4; padding: 20px; margin: 30px 0; border-radius: 5px;">
          <p style="margin: 0; color: #856404; font-size: 14px;">
            <strong>⏳ Please note:</strong> This appointment is pending confirmation. We will contact you within 24 hours to confirm availability and share the location details.
          </p>
        </div>

        <p style="color: #333; font-size: 16px; line-height: 1.6;">
          <strong>What to bring:</strong>
        </p>
        <ul style="color: #333; font-size: 16px; line-height: 1.8;">
          <li>Inspiration images or mood boards</li>
          <li>Fabric swatches (if you have any)</li>
          <li>Your vision and ideas</li>
        </ul>

        <p style="color: #333; font-size: 16px; line-height: 1.6; margin-top: 30px;">
          If you have any questions or need to reschedule, please contact us at:
        </p>

        <p style="color: #333; font-size: 16px; line-height: 1.6;">
          📧 <a href="mailto:Brielleelan@gmail.com" style="color: #000; text-decoration: none;">Brielleelan@gmail.com</a><br>
          📱 <a href="tel:+2347078948911" style="color: #000; text-decoration: none;">+234 707 894 8911</a>
        </p>

        <p style="color: #333; font-size: 16px; line-height: 1.6; margin-top: 30px;">
          We look forward to creating something beautiful with you!
        </p>

        <p style="color: #333; font-size: 16px; line-height: 1.6;">
          Warm regards,<br>
          <strong>The Brielle Élan Team</strong>
        </p>
      </div>

      <!-- Footer -->
      <div style="background: #f5f5f5; padding: 30px; text-align: center; border-top: 1px solid #e0e0e0;">
        <p style="color: #666; font-size: 12px; margin: 0 0 10px 0;">
          <strong>Please do not reply to this email.</strong><br>
          This is an automated confirmation message.
        </p>
        <p style="color: #999; font-size: 11px; margin: 0;">
          © 2025 Brielle Élan. All rights reserved.<br>
          123 Fashion Avenue, Ikorodu, Lagos
        </p>
      </div>
    </div>
  `;

  const customerTextContent = `
BRIELLE ÉLAN
Consultation Booking Confirmation

Dear ${name},

Thank you for your booking request!

We have received your consultation request and are excited to meet with you. Your appointment has been scheduled for:

Service: ${service}
Date: ${formattedDate}
Time: ${formattedTime}

⏳ PLEASE NOTE: This appointment is pending confirmation. We will contact you within 24 hours to confirm availability and share the location details.

WHAT TO BRING:
- Inspiration images or mood boards
- Fabric swatches (if you have any)
- Your vision and ideas

If you have any questions or need to reschedule, please contact us at:
Email: Brielleelan@gmail.com
Phone: +234 707 894 8911

We look forward to creating something beautiful with you!

Warm regards,
The Brielle Élan Team

---
PLEASE DO NOT REPLY TO THIS EMAIL.
This is an automated confirmation message.

© 2025 Brielle Élan. All rights reserved.
123 Fashion Avenue, Ikorodu, Lagos
  `;

  const customerEmail = {
    to: email, // Customer's email
    from: FROM_EMAIL,
    replyTo: 'Brielleelan@gmail.com', // Customer replies go to your real email
    subject: `Your Consultation is Scheduled - ${formattedDate}`,
    text: customerTextContent,
    html: customerHtml
  };

  // =================================================================
  // SEND BOTH EMAILS
  // =================================================================
  try {
    // Send both emails at the same time
    await Promise.all([
      sgMail.send(adminEmail),    // Email to you
      sgMail.send(customerEmail)   // Email to customer
    ]);
    
    // Log successful booking (helpful for debugging)
    console.log(`Consultation booking sent for ${name} (${email}) - ${service} on ${date} at ${time}`);
    
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ 
        success: true,
        message: 'Consultation request submitted successfully' 
      })
    };
  } catch (error) {
    console.error('SendGrid error:', error);
    const errMsg = (error && error.response && error.response.body) ? 
      error.response.body : error.message;
    
    return {
      statusCode: 502,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: 'Failed to send consultation request', 
        detail: errMsg 
      })
    };
  }
};

function escapeHtml(unsafe) {
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}