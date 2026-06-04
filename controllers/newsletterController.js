const Subscriber = require("../models/Subscriber");
const EmailConfig = require("../models/EmailConfig");
const { Post } = require("../models");
const EmailLog = require("../models/EmailLog");
const {
  generateTrackingId,
  injectTracking,
} = require("./emailTrackingController");

// ── HELPER: GET OR CREATE SINGLETON CONFIGURATION ────────────────────────────
async function getConfig() {
  let cfg = await EmailConfig.findOne({ singleton: "config" });
  if (!cfg) {
    cfg = await EmailConfig.create({
      singleton: "config",
      smtpHost: "",
      smtpPort: 587,
      smtpUser: "",
      smtpPass: "",
      smtpSecure: false,
      fromName: "LegendEmpire",
      fromEmail: "noreply@legendempire.com",
      replyTo: "",
      sendWelcome: true,
      digestEnabled: false,
    });
  }
  return cfg;
}

// ── HELPER: CORE NODEMAILER TRANSMISSION FLOW ────────────────────────────────
async function sendEmail({ to, subject, html, cfg }) {
  try {
    const nodemailer = require("nodemailer");

    if (!cfg.smtpHost || !cfg.smtpUser || !cfg.smtpPass) {
      console.warn(`⚠️ SMTP not configured. Skipping email to [${to}].`, {
        host: cfg.smtpHost,
        user: cfg.smtpUser,
        hasPass: !!cfg.smtpPass,
      });
      return false;
    }

    const transporter = nodemailer.createTransport({
      host: cfg.smtpHost,
      port: Number(cfg.smtpPort) || 587,
      secure: cfg.smtpSecure === true || cfg.smtpSecure === "true",
      auth: {
        user: cfg.smtpUser,
        pass: cfg.smtpPass,
      },
      timeout: 10000,
    });

    await transporter.sendMail({
      from: `"${cfg.fromName}" <${cfg.fromEmail}>`,
      replyTo: cfg.replyTo || cfg.fromEmail,
      to,
      subject,
      html,
    });

    console.log(`✅ Email sent to [${to}]`);
    return true;
  } catch (err) {
    console.error(`❌ Mail delivery pipeline failed for [${to}]:`, err.message);
    return false;
  }
}

// ── PUBLIC: REGISTER NEW SUBSCRIPTION ────────────────────────────────────────
exports.subscribe = async (req, res) => {
  try {
    const { email, name, tags } = req.body;

    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: "Email address is required." });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address.",
      });
    }

    const cleanEmail = email.toLowerCase().trim();
    let sub = await Subscriber.findOne({ email: cleanEmail });

    if (sub) {
      if (sub.status === "active") {
        return res
          .status(400)
          .json({ success: false, message: "You are already a subscriber!" });
      }
      sub.status = "active";
      sub.name = name ? name.trim() : sub.name;
      if (tags && Array.isArray(tags)) {
        sub.tags = [...new Set([...sub.tags, ...tags])];
      }
      await sub.save();
    } else {
      sub = await Subscriber.create({
        email: cleanEmail,
        name: name ? name.trim() : "",
        source: req.body.source || "website",
        tags: Array.isArray(tags) ? tags : ["general"],
        status: "active",
      });
    }

    res.status(201).json({
      success: true,
      message: "Successfully subscribed! Welcome aboard.",
      data: sub,
    });

    process.nextTick(async () => {
      try {
        const cfg = await getConfig();
        if (!cfg.sendWelcome) return;

        const siteUrl =
          process.env.FRONTEND_URL || "https://legendempire.vercel.app";
        const welcomeHtml = `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e5e7eb; border-radius: 16px;">
            <div style="text-align: center; margin-bottom: 24px;">
              <h2 style="color: #0d9488; margin: 0; font-size: 24px;">Welcome to LegendEmpire! 🚀</h2>
              <p style="color: #6b7280; font-size: 14px; margin-top: 4px;">Your digital hub for excellence</p>
            </div>
            <p style="font-size: 16px; color: #1f2937; line-height: 1.6;">Hi ${sub.name || "there"},</p>
            <p style="font-size: 16px; color: #4b5563; line-height: 1.6;">Thanks for joining our inner circle! You're now queued up to receive real-time, high-impact alerts regarding elite internships, global scholarships, curated remote job links, and technical career advice.</p>
            <div style="background-color: #f0fdfa; border-left: 4px solid #0d9488; padding: 16px; margin: 24px 0; border-radius: 4px;">
              <p style="margin: 0; font-size: 14px; color: #0f766e; font-weight: 500;">
                Pro-Tip: Move this email to your "Primary" tab so you never miss urgent application deadlines across Nigeria!
              </p>
            </div>
            <p style="font-size: 15px; color: #4b5563;">Cheers to your building journey,<br/><strong style="color: #1f2937;">The LegendEmpire Team</strong></p>
            <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 32px 0;" />
            <p style="font-size: 12px; color: #9ca3af; text-align: center; line-height: 1.5;">
              You received this because you signed up on our portal. 
              <a href="${siteUrl}/api/subscribers/unsubscribe?email=${encodeURIComponent(sub.email)}" style="color: #0d9488; text-decoration: underline;">Unsubscribe</a>
            </p>
          </div>
        `;

        await sendEmail({
          to: sub.email,
          subject: "Welcome to LegendEmpire! Your journey starts here 🚀",
          html: welcomeHtml,
          cfg,
        });
      } catch (err) {
        console.error("Welcome email background error:", err.message);
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── PUBLIC: OPT-OUT LANDING WRAPPER ──────────────────────────────────────────
exports.unsubscribe = async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).send(`
        <div style="font-family: sans-serif; text-align: center; padding: 50px;">
          <h3 style="color: #ef4444;">Missing email parameter.</h3>
        </div>
      `);
    }

    const cleanEmail = email.toLowerCase().trim();
    const sub = await Subscriber.findOne({ email: cleanEmail });

    if (!sub) {
      return res.status(404).send(`
        <div style="font-family: sans-serif; text-align: center; padding: 50px;">
          <h3 style="color: #f59e0b;">Email "${cleanEmail}" not found in our records.</h3>
        </div>
      `);
    }

    if (sub.status === "unsubscribed") {
      return res.send(`
        <div style="font-family: sans-serif; text-align: center; padding: 50px; color: #4b5563;">
          <h2>Already Unsubscribed</h2>
          <p>This email has already been removed from our list.</p>
        </div>
      `);
    }

    sub.status = "unsubscribed";
    sub.unsubscribedAt = new Date();
    await sub.save();

    res.send(`
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; padding: 80px 20px; background-color: #fafaf9; min-height: 100vh; box-sizing: border-box;">
        <div style="max-width: 480px; margin: 0 auto; background: #ffffff; padding: 40px; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
          <div style="width: 56px; height: 56px; background: #fef2f2; color: #ef4444; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px; font-size: 24px; font-weight: bold;">✕</div>
          <h2 style="color: #111827; margin-bottom: 8px; font-size: 22px; font-weight: 700;">Unsubscribed Successfully</h2>
          <p style="color: #4b5563; font-size: 15px; line-height: 1.5; margin-bottom: 28px;">
            <strong>${sub.email}</strong> has been removed. You will no longer receive emails from us.
          </p>
          <a href="${process.env.FRONTEND_URL || "https://legendempire.vercel.app"}" style="display: inline-block; background: #0d9488; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
            Return to LegendEmpire
          </a>
        </div>
      </div>
    `);
  } catch (err) {
    res.status(500).send(`<h3>Error: ${err.message}</h3>`);
  }
};

// ── ADMIN: BULK COUNTS & TELEMETRY SUMMARY ───────────────────────────────────
exports.getSubscriberCount = async (req, res) => {
  try {
    const total = await Subscriber.countDocuments();
    const active = await Subscriber.countDocuments({ status: "active" });
    const unsubscribed = await Subscriber.countDocuments({
      status: "unsubscribed",
    });

    const sourceBreakdown = await Subscriber.aggregate([
      { $group: { _id: "$source", count: { $sum: 1 } } },
    ]);

    res.json({
      success: true,
      data: { total, active, unsubscribed, sources: sourceBreakdown },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── ADMIN: PAGINATED REGISTRY VIEW ───────────────────────────────────────────
exports.getSubscribers = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 50));
    const search = req.query.search || "";
    const status = req.query.status || "";
    const tagFilter = req.query.tag || "";

    const filter = {};
    if (status) filter.status = status;
    if (tagFilter) filter.tags = tagFilter;
    if (search) {
      filter.$or = [
        { email: { $regex: search, $options: "i" } },
        { name: { $regex: search, $options: "i" } },
      ];
    }

    const total = await Subscriber.countDocuments(filter);
    const list = await Subscriber.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({
      success: true,
      total,
      page,
      pages: Math.ceil(total / limit),
      count: list.length,
      data: list,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── ADMIN: DELETE SUBSCRIBER ──────────────────────────────────────────────────
exports.deleteSubscriber = async (req, res) => {
  try {
    const sub = await Subscriber.findByIdAndDelete(req.params.id);
    if (!sub) {
      return res
        .status(404)
        .json({ success: false, message: "Subscriber not found." });
    }
    res.json({ success: true, message: "Subscriber removed successfully." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── ADMIN: GET EMAIL CONFIG ───────────────────────────────────────────────────
exports.getEmailConfig = async (req, res) => {
  try {
    const cfg = await getConfig();
    res.json({ success: true, data: cfg });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── ADMIN: SAVE EMAIL CONFIG ──────────────────────────────────────────────────
exports.saveEmailConfig = async (req, res) => {
  try {
    const cfg = await getConfig();
    const updatableFields = [
      "smtpHost",
      "smtpPort",
      "smtpUser",
      "smtpPass",
      "smtpSecure",
      "fromName",
      "fromEmail",
      "replyTo",
      "digestEnabled",
      "digestTime",
      "strategy",
      "strategyDesc",
      "sendWelcome",
      "unsubscribeUrl",
      "telegramBotToken",
      "telegramChatId",
    ];

    updatableFields.forEach((field) => {
      if (req.body[field] !== undefined) cfg[field] = req.body[field];
    });

    await cfg.save();
    res.json({
      success: true,
      message: "Settings saved successfully.",
      data: cfg,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── ADMIN: TEST EMAIL ─────────────────────────────────────────────────────────
exports.testEmail = async (req, res) => {
  try {
    const cfg = await getConfig();

    // ✅ Cleaned payload safety parsing. Will no longer crash if req.body is completely empty
    const targetEmail =
      (req.body && req.body.targetEmail) || cfg.fromEmail || cfg.smtpUser;

    if (!targetEmail) {
      return res.status(400).json({
        success: false,
        message:
          "No target email parameter specified, and no default configurations exist in Settings.",
      });
    }

    console.log("🧪 Test email config:", {
      host: cfg.smtpHost,
      port: cfg.smtpPort,
      user: cfg.smtpUser,
      secure: cfg.smtpSecure,
      from: cfg.fromEmail,
      target: targetEmail,
    });

    const verificationHtml = `
      <div style="font-family: sans-serif; padding: 24px; border: 2px dashed #0d9488; border-radius: 12px; max-width: 500px; margin: 20px auto;">
        <h3 style="color: #0d9488; margin-top: 0;">🛠️ LegendEmpire SMTP Test</h3>
        <p style="color: #374151; font-size: 14px; line-height: 1.5;">
          Your SMTP configuration is working correctly! ✅
        </p>
        <div style="background-color: #f3f4f6; padding: 12px; border-radius: 6px; font-family: monospace; font-size: 12px; color: #4b5563; margin-top: 16px;">
          Time     : ${new Date().toISOString()}<br/>
          SSL/TLS  : ${cfg.smtpSecure ? "Enabled (port 465)" : "STARTTLS (port 587)"}<br/>
          Host     : ${cfg.smtpHost}
        </div>
      </div>
    `;

    const success = await sendEmail({
      to: targetEmail,
      subject: "LegendEmpire SMTP Test ✅",
      html: verificationHtml,
      cfg,
    });

    if (success) {
      res.json({
        success: true,
        message: `Test email sent successfully to ${targetEmail} ✅`,
      });
    } else {
      res.status(500).json({
        success: false,
        message:
          "SMTP connection failed. Check your Host, Port, Username and Password in settings.",
      });
    }
  } catch (err) {
    console.error("testEmail crash:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── ADMIN: SEND DIGEST ────────────────────────────────────────────────────────
exports.sendDigest = async (req, res) => {
  try {
    const { subject, customHtml, targetTags } = req.body;

    // ✅ Cleaned: Set default subject fallback if empty text string is passed from input state
    const finalSubject =
      subject && subject.trim()
        ? subject.trim()
        : "LegendEmpire Weekly Digest — Top Opportunities This Week";

    const cfg = await getConfig();

    const query = { status: "active" };
    if (targetTags && Array.isArray(targetTags) && targetTags.length > 0) {
      query.tags = { $in: targetTags };
    }

    const subscribers = await Subscriber.find(query);
    if (subscribers.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No active subscribers found.",
      });
    }

    // ✅ Cleaned: Auto-generate HTML content layouts dynamically from recent database documents if empty payload state object returns true
    let finalHtml = customHtml && customHtml.trim() ? customHtml : null;

    if (!finalHtml) {
      const siteUrl =
        process.env.FRONTEND_URL || "https://legendempire.vercel.app";

      const recentPosts = await Post.find({ status: "published" })
        .sort({ createdAt: -1 })
        .limit(5)
        .select("title excerpt slug createdAt");

      if (recentPosts.length === 0) {
        return res.status(400).json({
          success: false,
          message:
            "No published posts found to auto-generate digest. Please add custom HTML or publish a post first.",
        });
      }

      finalHtml = `
        <div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1f2937;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h2 style="color: #0d9488; margin: 0; font-size: 24px;">Latest from LegendEmpire 🚀</h2>
            <p style="color: #6b7280; font-size: 14px; margin-top: 6px;">Here's what's new for you this week</p>
          </div>

          ${recentPosts
            .map(
              (post) => `
            <div style="border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; margin-bottom: 16px;">
              <h3 style="margin: 0 0 8px; font-size: 17px;">
                <a href="${siteUrl}/post/${post.slug}" style="color: #0d9488; text-decoration: none;">
                  ${post.title}
                </a>
              </h3>
              <p style="color: #6b7280; font-size: 14px; margin: 0 0 12px; line-height: 1.5;">
                ${post.excerpt || "Click to read the full post on LegendEmpire."}
              </p>
              <a href="${siteUrl}/post/${post.slug}" style="display: inline-block; background: #0d9488; color: #ffffff; padding: 8px 16px; border-radius: 6px; text-decoration: none; font-size: 13px; font-weight: 600;">
                Read More →
              </a>
            </div>
          `,
            )
            .join("")}

          <div style="text-align: center; margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
            <a href="${siteUrl}" style="color: #0d9488; text-decoration: none; font-size: 14px; font-weight: 600;">
              Visit LegendEmpire →
            </a>
          </div>
        </div>
      `;
    }

    const trackingId = generateTrackingId();
    const baseUrl =
      process.env.API_BASE_URL || "https://legendempire.vercel.app";

    const emailLog = await EmailLog.create({
      subject: finalSubject,
      sentTo: subscribers.length,
      strategy: cfg.strategy || "manual",
      trackingId,
      html: finalHtml,
      opens: 0,
      clicks: 0,
      sentAt: new Date(),
    });

    res.json({
      success: true,
      message: `Digest queued for ${subscribers.length} subscribers! Sending in background.`,
      data: { logId: emailLog._id, trackingId },
    });

    process.nextTick(async () => {
      let successfullySent = 0;
      let failureCount = 0;

      console.log(
        `[Digest Worker] Starting send loop for ${subscribers.length} subscribers...`,
      );

      for (const sub of subscribers) {
        try {
          const trackedTemplate = injectTracking(
            finalHtml,
            trackingId,
            sub.email,
            baseUrl,
          );

          const deliveryOk = await sendEmail({
            to: sub.email,
            subject: finalSubject,
            html: trackedTemplate,
            cfg,
          });

          if (deliveryOk) {
            successfullySent++;
            sub.lastEmailAt = new Date();
            await sub.save();
          } else {
            failureCount++;
          }

          await new Promise((resolve) => setTimeout(resolve, 100));
        } catch (innerErr) {
          console.error(
            `[Digest Worker] Error for [${sub.email}]:`,
            innerErr.message,
          );
          failureCount++;
        }
      }

      emailLog.sentTo = successfullySent;
      await emailLog.save();

      cfg.digestLastSent = new Date();
      await cfg.save();

      console.log(
        `[Digest Worker] Done. Sent: ${successfullySent}, Failed: ${failureCount}. ID: ${trackingId}`,
      );
    });
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: err.message });
    } else {
      console.error("Digest worker fatal error:", err.message);
    }
  }
};

// ── ADMIN: EXPORT SUBSCRIBERS AS CSV ─────────────────────────────────────────
exports.exportSubscribers = async (req, res) => {
  try {
    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=legendempire_subscribers_${new Date().toISOString().split("T")[0]}.csv`,
    );
    res.setHeader("Transfer-Encoding", "chunked");

    res.write("Name,Email,Status,SubscribedDate,OpensCount,ClicksCount\n");

    const cursor = Subscriber.find({ status: "active" })
      .sort({ createdAt: -1 })
      .cursor();

    for (
      let doc = await cursor.next();
      doc != null;
      doc = await cursor.next()
    ) {
      const cleanName = doc.name ? doc.name.replace(/"/g, '""') : "";
      const dateStr = doc.createdAt
        ? doc.createdAt.toISOString().split("T")[0]
        : "";
      res.write(
        `"${cleanName}","${doc.email}","${doc.status}","${dateStr}",${doc.opens || 0},${doc.clicks || 0}\n`,
      );
    }

    res.end();
  } catch (err) {
    console.error("CSV export error:", err.message);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: "CSV export failed." });
    }
  }
};
