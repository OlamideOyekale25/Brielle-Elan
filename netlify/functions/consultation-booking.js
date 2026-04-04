const { Resend } = require('resend');

// Initialize Resend API key from environment
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const FROM_EMAIL = process.env.FROM_EMAIL || 'onboarding@resend.dev';
const TO_EMAIL = process.env.TO_EMAIL || '';

let resend;
if (RESEND_API_KEY) {
  resend = new Resend(RESEND_API_KEY);
}

exports.handler = async function (event, context) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { ...corsHeaders, 'Allow': 'POST' },
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  if (!RESEND_API_KEY || !FROM_EMAIL) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: 'Resend not configured. Set RESEND_API_KEY and FROM_EMAIL environment variables.' 
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

  if (data['bot-field']) {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ success: true })
    };
  }

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

  const name = data.name.trim();
  const email = data.email.trim();
  const phone = data.phone.trim();
  const service = data.service.trim();
  const date = data.date.trim();
  const time = data.time.trim();
  const message = data.message ? data.message.trim() : '';

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Invalid email format' })
    };
  }

  let formattedDate = date;
  try {
    const dateObj = new Date(date);
    formattedDate = dateObj.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch (e) {}

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
  } catch (e) {}

  // EMAIL 1: Notification to YOU (business owner)
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

  // EMAIL 2: Confirmation to CUSTOMER
  const customerHtml = `
    <div style="font-family: 'Georgia', serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
      <div style="background: #000000; padding: 30px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 28px; letter-spacing: 2px;">BRIELLE ÉLAN</h1>
      </div>

      <div style="padding: 40px 30px;">
        <h2 style="color: #000000; font-size: 24px; margin-bottom: 20px;">Thank You for Your Booking Request!</h2>
        
        <p style="color: #333; font-size: 16px; line-height: 1.6;">
          Dear ${escapeHtml(name)},
        </p>
        
        <p style="color: #333; font-size: 16px; line-height: 1.6;">
          We have received your consultation request and are excited to meet with you! Your appointment has been scheduled for:
        </p>

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

  try {
    // Send emails SEPARATELY with better error handling
    console.log(`Attempting to send admin email to ${TO_EMAIL}`);
    const adminResult = await resend.emails.send({
      from: FROM_EMAIL,
      to: TO_EMAIL,
      subject: `[Consultation Request] ${name} - ${service}`,
      html: adminHtml
    });
    console.log('Admin email sent successfully:', adminResult);

    console.log(`Attempting to send customer email to ${email}`);
    const customerResult = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      replyTo: 'Brielleelan@gmail.com',
      subject: `Your Consultation is Scheduled - ${formattedDate}`,
      html: customerHtml
    });
    console.log('Customer email sent successfully:', customerResult);
    
    console.log(`Both emails sent successfully for ${name} (${email}) - ${service} on ${date} at ${time}`);
    
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ 
        success: true,
        message: 'Consultation request submitted successfully' 
      })
    };
  } catch (error) {
    console.error('Resend error:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    
    return {
      statusCode: 502,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: 'Failed to send consultation request', 
        detail: error.message
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