const Subscriber = require("../models/Subscriber");
const EmailConfig = require("../models/EmailConfig");
const { Post } = require("../models");

// ── Helper: get or create singleton email config ──
async function getConfig() {
  let cfg = await EmailConfig.findOne({ singleton: "config" });
  if (!cfg) cfg = await EmailConfig.create({ singleton: "config" });
  return cfg;
}

// ── Helper: send email via nodemailer ─────────────
async function sendEmail({ to, subject, html, cfg }) {
  try {
    const nodemailer = require("nodemailer");
    const transporter = nodemailer.createTransport({
      host: cfg.smtpHost,
      port: cfg.smtpPort,
      secure: cfg.smtpSecure,
      auth: { user: cfg.smtpUser, pass: cfg.smtpPass },
    });
    await transporter.sendMail({
      from: `"${cfg.fromName}" <${cfg.fromEmail}>`,
      replyTo: cfg.replyTo || cfg.fromEmail,
      to,
      subject,
      html,
    });
    return true;
  } catch (err) {
    console.error("Email send error:", err.message);
    return false;
  }
}

// ── PUBLIC: Subscribe ──────────────────────────────
exports.subscribe = async (req, res) => {
  try {
    const { email, name } = req.body;
    if (!email || !email.includes("@"))
      return res
        .status(400)
        .json({ success: false, message: "Valid email required." });

    const existing = await Subscriber.findOne({
      email: email.toLowerCase().trim(),
    });
    if (existing) {
      if (existing.status === "unsubscribed") {
        existing.status = "active";
        await existing.save();
        return res.json({
          success: true,
          message: "Welcome back! You are resubscribed.",
        });
      }
      return res
        .status(400)
        .json({ success: false, message: "This email is already subscribed." });
    }

    const sub = await Subscriber.create({
      email: email.toLowerCase().trim(),
      name: name?.trim() || "",
    });

    // Send welcome email if enabled
    const cfg = await getConfig();
    if (cfg.sendWelcome && cfg.smtpHost && cfg.fromEmail) {
      const welcomeHtml = `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px 24px">
          <h1 style="color:#0d9488;font-size:24px;margin-bottom:8px">Welcome to LegendEmpire! 🎉</h1>
          <p style="color:#555;font-size:15px;line-height:1.6">
            Hi ${sub.name || "there"},<br><br>
            You're now subscribed to <strong>LegendEmpire</strong> — Nigeria's trusted source for
            scholarships, remote jobs, technology, and financial freedom.
          </p>
          <p style="color:#555;font-size:15px;line-height:1.6">
            We'll send you the best opportunities and insights regularly. No spam. Ever.
          </p>
          <a href="${cfg.unsubscribeUrl || "#"}" style="color:#999;font-size:12px">Unsubscribe</a>
        </div>
      `;
      await sendEmail({
        to: sub.email,
        subject: `Welcome to LegendEmpire 🎉`,
        html: welcomeHtml,
        cfg,
      });
    }

    res
      .status(201)
      .json({
        success: true,
        message: "Subscribed successfully! Welcome aboard.",
      });
  } catch (err) {
    if (err.code === 11000)
      return res
        .status(400)
        .json({ success: false, message: "This email is already subscribed." });
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── PUBLIC: Unsubscribe via link ───────────────────
exports.unsubscribe = async (req, res) => {
  try {
    const { email } = req.query;
    if (!email)
      return res
        .status(400)
        .json({ success: false, message: "Email required." });
    await Subscriber.findOneAndUpdate({ email }, { status: "unsubscribed" });
    res.json({
      success: true,
      message: "You have been unsubscribed successfully.",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── ADMIN: Get all subscribers ─────────────────────
exports.getSubscribers = async (req, res) => {
  try {
    const page = +req.query.page || 1;
    const limit = +req.query.limit || 50;
    const status = req.query.status || "active";
    const q = req.query.search || "";

    const filter = { status };
    if (q)
      filter.$or = [
        { email: { $regex: q, $options: "i" } },
        { name: { $regex: q, $options: "i" } },
      ];

    const total = await Subscriber.countDocuments(filter);
    const subs = await Subscriber.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const activeCount = await Subscriber.countDocuments({ status: "active" });
    const unsubCount = await Subscriber.countDocuments({
      status: "unsubscribed",
    });

    res.json({
      success: true,
      data: subs,
      pagination: { total, page, pages: Math.ceil(total / limit) },
      stats: { active: activeCount, unsubscribed: unsubCount },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── ADMIN: Delete subscriber ───────────────────────
exports.deleteSubscriber = async (req, res) => {
  try {
    await Subscriber.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Subscriber deleted." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── ADMIN: Get email config ────────────────────────
exports.getEmailConfig = async (req, res) => {
  try {
    const cfg = await getConfig();
    // Never return SMTP password in response
    const safe = cfg.toObject();
    safe.smtpPass = safe.smtpPass ? "••••••••" : "";
    res.json({ success: true, data: safe });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── ADMIN: Save email config ───────────────────────
exports.saveEmailConfig = async (req, res) => {
  try {
    const cfg = await getConfig();
    const fields = [
      "smtpHost",
      "smtpPort",
      "smtpUser",
      "fromName",
      "fromEmail",
      "replyTo",
      "smtpSecure",
      "digestEnabled",
      "digestTime",
      "strategy",
      "sendWelcome",
      "unsubscribeUrl",
    ];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) cfg[f] = req.body[f];
    });
    // Only update password if a real value was sent
    if (req.body.smtpPass && !req.body.smtpPass.includes("•")) {
      cfg.smtpPass = req.body.smtpPass;
    }
    await cfg.save();
    res.json({ success: true, message: "Email settings saved." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── ADMIN: Test SMTP connection ────────────────────
exports.testEmail = async (req, res) => {
  try {
    const cfg = await getConfig();
    if (!cfg.smtpHost || !cfg.fromEmail)
      return res
        .status(400)
        .json({ success: false, message: "Configure SMTP settings first." });
    const sent = await sendEmail({
      to: req.user.email,
      subject: "LegendEmpire — Email Test ✅",
      html: "<p>Your email configuration is working correctly!</p>",
      cfg,
    });
    if (sent)
      res.json({
        success: true,
        message: `Test email sent to ${req.user.email}`,
      });
    else
      res
        .status(500)
        .json({
          success: false,
          message: "SMTP connection failed. Check your settings.",
        });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── ADMIN: Send daily digest manually ─────────────
exports.sendDigest = async (req, res) => {
  try {
    const cfg = await getConfig();
    if (!cfg.smtpHost || !cfg.fromEmail)
      return res
        .status(400)
        .json({ success: false, message: "Configure SMTP settings first." });

    const { subject, customHtml } = req.body;

    // Get today's or recent posts
    const since = new Date();
    since.setDate(since.getDate() - 1);
    let posts = await Post.find({
      status: "published",
      publishedAt: { $gte: since },
    })
      .populate("category", "name color icon")
      .sort({ publishedAt: -1 })
      .limit(10);

    if (posts.length === 0) {
      posts = await Post.find({ status: "published" })
        .populate("category", "name color icon")
        .sort({ publishedAt: -1 })
        .limit(5);
    }

    const siteUrl =
      process.env.FRONTEND_URL || "https://legendempire.vercel.app";

    const postsHtml = posts
      .map(
        (p) => `
      <div style="border-bottom:1px solid #eee;padding:16px 0">
        ${p.coverImage ? `<img src="${p.coverImage}" style="width:100%;border-radius:8px;margin-bottom:10px" />` : ""}
        <span style="background:${p.category?.color || "#0d9488"}22;color:${p.category?.color || "#0d9488"};
          padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600">
          ${p.category?.icon || ""} ${p.category?.name || ""}
        </span>
        <h3 style="margin:8px 0 6px;font-size:16px">
          <a href="${siteUrl}/post/${p.slug}" style="color:#1a1714;text-decoration:none">${p.title}</a>
        </h3>
        <p style="color:#75685a;font-size:13px;line-height:1.5;margin:0 0 8px">${p.excerpt?.substring(0, 120) || ""}…</p>
        <a href="${siteUrl}/post/${p.slug}"
          style="color:#0d9488;font-size:13px;font-weight:600;text-decoration:none">Read more →</a>
      </div>
    `,
      )
      .join("");

    const emailHtml =
      customHtml ||
      `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:0">
        <div style="background:#0d9488;padding:24px;text-align:center">
          <h1 style="color:white;margin:0;font-size:22px">LegendEmpire</h1>
          <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:13px">Your daily digest</p>
        </div>
        <div style="padding:24px">
          <h2 style="font-size:18px;color:#1a1714;margin:0 0 16px">Latest from LegendEmpire</h2>
          ${postsHtml}
        </div>
        <div style="background:#f8f7f4;padding:16px 24px;text-align:center">
          <p style="color:#a89d8d;font-size:11px;margin:0">
            You're receiving this because you subscribed at <a href="${siteUrl}" style="color:#0d9488">${siteUrl}</a><br>
            <a href="${siteUrl}/api/subscribers/unsubscribe?email={{email}}" style="color:#a89d8d">Unsubscribe</a>
          </p>
        </div>
      </div>
    `;

    // Send to all active subscribers
    const subscribers = await Subscriber.find({ status: "active" });
    let sent = 0,
      failed = 0;

    for (const sub of subscribers) {
      const personalised = emailHtml.replace(
        "{{email}}",
        encodeURIComponent(sub.email),
      );
      const ok = await sendEmail({
        to: sub.email,
        subject:
          subject ||
          `LegendEmpire Daily Digest — ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}`,
        html: personalised,
        cfg,
      });
      if (ok) {
        sent++;
        sub.lastEmailAt = new Date();
        await sub.save();
      } else failed++;
    }

    cfg.digestLastSent = new Date();
    await cfg.save();

    res.json({
      success: true,
      message: `Digest sent to ${sent} subscribers.${failed ? ` ${failed} failed.` : ""}`,
      sent,
      failed,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── ADMIN: Export subscribers as CSV ──────────────
exports.exportSubscribers = async (req, res) => {
  try {
    const subs = await Subscriber.find({ status: "active" }).sort({
      createdAt: -1,
    });
    const rows = [
      "Name,Email,Subscribed,Opens,Clicks",
      ...subs.map(
        (s) =>
          `"${s.name}","${s.email}","${s.createdAt.toISOString().split("T")[0]}","${s.opens}","${s.clicks}"`,
      ),
    ];
    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="subscribers.csv"',
    );
    res.send(rows.join("\n"));
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
