const express = require("express");
const r = express.Router();
const rateLimit = require("express-rate-limit");

const contactLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: {
    success: false,
    message: "Too many messages. Try again in an hour.",
  },
});

r.post("/", contactLimit, async (req, res) => {
  try {
    const { name, email, subject, message, website } = req.body;

    // Honeypot check
    if (website) return res.json({ success: true, message: "Message sent!" });

    if (!name || !email || !message)
      return res
        .status(400)
        .json({ success: false, message: "Name, email and message required." });

    // Load email config from DB
    const EmailConfig = require("../models/EmailConfig");
    let cfg = await EmailConfig.findOne({ singleton: "config" });

    if (!cfg || !cfg.smtpHost || !cfg.fromEmail) {
      // Fallback: log to console if email not configured
      console.log("📩 New contact message:", { name, email, subject, message });
      return res.json({
        success: true,
        message: "Message received! We'll get back to you soon.",
      });
    }

    const nodemailer = require("nodemailer");
    const transporter = nodemailer.createTransport({
      host: cfg.smtpHost,
      port: cfg.smtpPort || 587,
      secure: cfg.smtpSecure || false,
      auth: { user: cfg.smtpUser, pass: cfg.smtpPass },
    });

    await transporter.sendMail({
      from: `"${cfg.fromName}" <${cfg.fromEmail}>`,
      to: cfg.replyTo || cfg.fromEmail,
      replyTo: email,
      subject: `📩 Contact: ${subject || "New message from LegendEmpire"}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
          <h2 style="color:#0d9488;margin-bottom:4px">New Contact Message</h2>
          <p style="color:#78716c;font-size:13px;margin-bottom:24px">From legendempire.vercel.app contact form</p>
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <tr><td style="padding:8px 0;color:#78716c;width:120px">Name</td><td style="padding:8px 0;font-weight:600;color:#1c1917">${name}</td></tr>
            <tr><td style="padding:8px 0;color:#78716c">Email</td><td style="padding:8px 0"><a href="mailto:${email}" style="color:#0d9488">${email}</a></td></tr>
            <tr><td style="padding:8px 0;color:#78716c">Subject</td><td style="padding:8px 0;color:#1c1917">${subject || "No subject"}</td></tr>
          </table>
          <div style="background:#f5f5f4;border-radius:12px;padding:16px;margin-top:16px">
            <p style="margin:0;color:#292524;line-height:1.6;white-space:pre-wrap">${message}</p>
          </div>
          <p style="margin-top:16px;font-size:12px;color:#a8a29e">
            Reply directly to this email to respond to ${name}.
          </p>
        </div>
      `,
    });

    res.json({
      success: true,
      message: "Message sent! We'll reply within 24-48 hours.",
    });
  } catch (err) {
    console.error("Contact email error:", err.message);
    res.json({ success: true, message: "Message received! We'll reply soon." }); // Don't expose errors
  }
});

module.exports = r;
