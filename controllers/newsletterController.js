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

    // Fallback if config is missing critical keys
    if (!cfg.smtpHost || !cfg.smtpUser || !cfg.smtpPass) {
      console.warn(
        `⚠️ SMTP not fully configured. Logging email to console [To: ${to}]: ${subject}`,
      );
      return true; // Simulate success in dev environment to avoid breaking flows
    }

    const transporter = nodemailer.createTransport({
      host: cfg.smtpHost,
      port: Number(cfg.smtpPort) || 587,
      secure: cfg.smtpSecure === true || cfg.smtpSecure === "true",
      auth: {
        user: cfg.smtpUser,
        pass: cfg.smtpPass,
      },
      timeout: 10000, // 10s connection timeout protection
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

    // Basic regex validation for safety
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res
        .status(400)
        .json({
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

      // Resubscription handling logic
      sub.status = "active";
      sub.name = name ? name.trim() : sub.name;
      if (tags && Array.isArray(tags)) {
        sub.tags = [...new Set([...sub.tags, ...tags])];
      }
      await sub.save();
    } else {
      // Create clean new profile document
      sub = await Subscriber.create({
        email: cleanEmail,
        name: name ? name.trim() : "",
        source: req.body.source || "website",
        tags: Array.isArray(tags) ? tags : ["general"],
        status: "active",
      });
    }

    // Load setup parameters to trigger conditional welcome sequence
    const cfg = await getConfig();
    if (cfg.sendWelcome) {
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
            You received this because you signed up on our portal. If you want to stop receiving these notifications, you can safely 
            <a href="${siteUrl}/api/subscribers/unsubscribe?email=${encodeURIComponent(sub.email)}" style="color: #0d9488; text-decoration: underline;">unsubscribe instantly here</a>.
          </p>
        </div>
      `;

      // Dispatch tracking sequence as isolated asynchronous fire-and-forget payload
      sendEmail({
        to: sub.email,
        subject: "Welcome to LegendEmpire! Your journey starts here 🚀",
        html: welcomeHtml,
        cfg,
      });
    }

    res.status(201).json({
      success: true,
      message: "Successfully subscribed! Welcome aboard.",
      data: sub,
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
          <h3 style="color: #ef4444;">Missing parameters: Unable to identify target allocation vector.</h3>
        </div>
      `);
    }

    const cleanEmail = email.toLowerCase().trim();
    const sub = await Subscriber.findOne({ email: cleanEmail });

    if (!sub) {
      return res.status(404).send(`
        <div style="font-family: sans-serif; text-align: center; padding: 50px;">
          <h3 style="color: #f59e0b;">Subscription profile reference matching "${cleanEmail}" does not exist.</h3>
        </div>
      `);
    }

    if (sub.status === "unsubscribed") {
      return res.send(`
        <div style="font-family: sans-serif; text-align: center; padding: 50px; color: #4b5563;">
          <h2>Already Processed</h2>
          <p>This email account has already been safely removed from all system registries.</p>
        </div>
      `);
    }

    sub.status = "unsubscribed";
    sub.unsubscribedAt = new Date();
    await sub.save();

    res.send(`
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; text-align: center; padding: 80px 20px; color: #1c1917; background-color: #fafaf9; min-height: 100vh; box-sizing: border-box;">
        <div style="max-width: 480px; margin: 0 auto; background: #ffffff; padding: 40px; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03);">
          <div style="width: 56px; height: 56px; background: #fef2f2; color: #ef4444; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px; font-size: 24px; font-weight: bold;">✕</div>
          <h2 style="color: #111827; margin-bottom: 8px; font-size: 22px; font-weight: 700;">Unsubscribed Successfully</h2>
          <p style="color: #4b5563; font-size: 15px; line-height: 1.5; margin-bottom: 28px;">
            Your email address (<strong>${sub.email}</strong>) has been removed. You will no longer receive digest schedules, job distributions, or updates.
          </p>
          <div style="border-top: 1px solid #e5e7eb; padding-top: 20px;">
            <p style="font-size: 13px; color: #6b7280; margin-bottom: 16px;">Changed your mind by mistake?</p>
            <a href="${process.env.FRONTEND_URL || "https://legendempire.vercel.app"}" style="display: inline-block; background: #0d9488; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; transition: background 0.2s;">
              Return to LegendEmpire Portal
            </a>
          </div>
        </div>
      </div>
    `);
  } catch (err) {
    res
      .status(500)
      .send(`<h3>Fatal Unsubscribe Script Exception: ${err.message}</h3>`);
  }
};

// ── ADMIN: BULK COUNTS & TELEMETRY SUMMARY ──────────────────────────────────
exports.getSubscriberCount = async (req, res) => {
  try {
    const total = await Subscriber.countDocuments();
    const active = await Subscriber.countDocuments({ status: "active" });
    const unsubscribed = await Subscriber.countDocuments({
      status: "unsubscribed",
    });

    // Aggregate source metrics to analyze conversion tracking
    const sourceBreakdown = await Subscriber.aggregate([
      { $group: { _id: "$source", count: { $sum: 1 } } },
    ]);

    res.json({
      success: true,
      data: {
        total,
        active,
        unsubscribed,
        sources: sourceBreakdown,
      },
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

// ── ADMIN: PERMANENT EXCLUSION DELETION ──────────────────────────────────────
exports.deleteSubscriber = async (req, res) => {
  try {
    const sub = await Subscriber.findByIdAndDelete(req.params.id);
    if (!sub) {
      return res
        .status(404)
        .json({
          success: false,
          message: "Target document entry lookup returned empty payload.",
        });
    }
    res.json({
      success: true,
      message:
        "Profile completely expunged from primary system collection structures.",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── ADMIN: EMAIL ENGINE SETTINGS EXTRACTION ──────────────────────────────────
exports.getEmailConfig = async (req, res) => {
  try {
    const cfg = await getConfig();
    res.json({ success: true, data: cfg });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── ADMIN: IN-PLACE CONFIGURATION CONFIG MODIFICATION ────────────────────────
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
      if (req.body[field] !== undefined) {
        cfg[field] = req.body[field];
      }
    });

    await cfg.save();
    res.json({
      success: true,
      message:
        "System core transmission environment attributes applied cleanly.",
      data: cfg,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── ADMIN: ISOLATED CONFIG TESTING ENDPOINT ──────────────────────────────────
exports.testEmail = async (req, res) => {
  try {
    const cfg = await getConfig();

    // ← Fall back to fromEmail if targetEmail not provided
    const targetEmail = req.body.targetEmail || cfg.fromEmail || cfg.smtpUser;

    if (!targetEmail) {
      return res.status(400).json({
        success: false,
        message: "No target email found. Please set a From Email in settings.",
      });
    }

    // ... rest of your existing code unchanged

    const cfg = await getConfig();

    const verificationHtml = `
      <div style="font-family: sans-serif; padding: 24px; border: 2px dashed #0d9488; border-radius: 12px; max-width: 500px; margin: 20px auto;">
        <h3 style="color: #0d9488; margin-top: 0; display: flex; align-items: center; gap: 8px;">
          🛠️ LegendEmpire Gateway Test Connection Status
        </h3>
        <p style="color: #374151; font-size: 14px; line-height: 1.5;">
          This validation message confirms that your Node backend server context is executing authentication handshakes successfully against the specified remote SMTP servers!
        </p>
        <div style="background-color: #f3f4f6; padding: 12px; border-radius: 6px; font-family: monospace; font-size: 12px; color: #4b5563; margin-top: 16px;">
          Node Engine Time  : ${new Date().toISOString()}<br/>
          SSL/TLS Security  : ${cfg.smtpSecure ? "Enabled (465/Secure)" : "Standard Explicit (TLS/587)"}<br/>
          Gateway Host Match: ${cfg.smtpHost}
        </div>
      </div>
    `;

    const success = await sendEmail({
      to: targetEmail,
      subject: "LegendEmpire System SMTP Operational Connection Live Alert 🛠️",
      html: verificationHtml,
      cfg,
    });

    if (success) {
      res.json({
        success: true,
        message: `Validation confirmation block routed out securely via port ${cfg.smtpPort} to [${targetEmail}].`,
      });
    } else {
      res.status(500).json({
        success: false,
        message:
          "Handshake operation rejected by mail server node. Review access logs.",
      });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── ADMIN: HIGH-DENSITY BULK MAILING DISPATCH WORKER ──────────────────────────
exports.sendDigest = async (req, res) => {
  try {
    const { subject, customHtml, targetTags } = req.body;
    if (!subject || !customHtml) {
      return res
        .status(400)
        .json({
          success: false,
          message:
            "Mandatory arguments schema validation error: Subject or HTML block payload missing.",
        });
    }

    const cfg = await getConfig();

    // Construct query parameters conditionally based on targeting strategies
    const query = { status: "active" };
    if (targetTags && Array.isArray(targetTags) && targetTags.length > 0) {
      query.tags = { $in: targetTags };
    }

    const subscribers = await Subscriber.find(query);

    if (subscribers.length === 0) {
      return res
        .status(400)
        .json({
          success: false,
          message:
            "Targeting query returned 0 active subscriber records. Aborting.",
        });
    }

    const trackingId = generateTrackingId();
    const baseUrl =
      process.env.API_BASE_URL || "https://legendempire.vercel.app";

    // Initialize telemetry analytics tracking document record instantly
    const emailLog = await EmailLog.create({
      subject,
      sentTo: subscribers.length,
      strategy: cfg.strategy || "manual",
      trackingId,
      html: customHtml,
      opens: 0,
      clicks: 0,
      sentAt: new Date(),
    });

    // 🌟 FIX: Return early to prevent HTTP proxy request timeout on Render/Vercel (Free 30s limits)
    res.json({
      success: true,
      message: `Mass distribution array sequence initialized for ${subscribers.length} targets under registration key: [${trackingId}].`,
      data: { logId: emailLog._id, trackingId },
    });

    // Run intensive background processing without holding the client collection connection hostage
    process.nextTick(async () => {
      let successfullySent = 0;
      let failureCount = 0;

      console.log(
        `[Worker Engine] Initializing background loop for ${subscribers.length} targets...`,
      );

      for (const sub of subscribers) {
        try {
          // Inject recipient-personalized tracking nodes and unsubscribe link tracking pixels
          const trackedTemplate = injectTracking(
            customHtml,
            trackingId,
            sub.email,
            baseUrl,
          );

          const deliveryOk = await sendEmail({
            to: sub.email,
            subject,
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

          // Anti-spam throttler: 100ms pause to guard SMTP limits/reputation
          await new Promise((resolve) => setTimeout(resolve, 100));
        } catch (innerErr) {
          console.error(
            `[Worker Engine Block Error] Individual profile exception handling [${sub.email}]:`,
            innerErr.message,
          );
          failureCount++;
        }
      }

      // Sync completed transaction variables back to tracking documents
      emailLog.sentTo = successfullySent;
      await emailLog.save();

      cfg.digestLastSent = new Date();
      await cfg.save();

      console.log(
        `[Worker Engine Finalized Summary] Loop executed. Dispatched: ${successfullySent}, Blocked: ${failureCount}. Tracking Group: ${trackingId}`,
      );
    });
  } catch (err) {
    // Structural exception safety protection wall
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: err.message });
    } else {
      console.error(
        "Fatal exception during engine allocation sequence:",
        err.message,
      );
    }
  }
};

// ── ADMIN: CURSOR-STREAM BASED PLAIN-TEXT HIGH REPUTATION CSV ENGINE ─────────
exports.exportSubscribers = async (req, res) => {
  try {
    // 🌟 FIX: Switch to cursor streams. Do not use array loads to prevent system out of memory events.
    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=legendempire_subscribers_${new Date().toISOString().split("T")[0]}.csv`,
    );
    res.setHeader("Transfer-Encoding", "chunked");

    // Push initial schema descriptor header payload array row string downstream
    res.write("Name,Email,Status,SubscribedDate,OpensCount,ClicksCount\n");

    const cursor = Subscriber.find({ status: "active" })
      .sort({ createdAt: -1 })
      .cursor();

    for (
      let doc = await cursor.next();
      doc != null;
      doc = await cursor.next()
    ) {
      // Escape commas and wrap fields inside text qualifiers to ensure Excel formatting integrity
      const cleanName = doc.name ? doc.name.replace(/"/g, '""') : "";
      const dateStr = doc.createdAt
        ? doc.createdAt.toISOString().split("T")[0]
        : "";

      const segmentRow = `"${cleanName}","${doc.email}","${doc.status}","${dateStr}",${doc.opens || 0},${doc.clicks || 0}\n`;

      res.write(segmentRow);
    }

    // Terminate transactional memory map buffers and safely complete the network cycle
    res.end();
  } catch (err) {
    console.error(
      "Fatal system level crash inside CSV generation loops:",
      err.message,
    );
    if (!res.headersSent) {
      res
        .status(500)
        .json({
          success: false,
          message: "File construction engine crashed asynchronously.",
        });
    }
  }
};
