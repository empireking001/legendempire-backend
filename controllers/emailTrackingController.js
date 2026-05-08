const EmailLog = require("../models/EmailLog");
const Subscriber = require("../models/Subscriber");
const { v4: uuidv4 } = require("uuid");

// ── Generate tracking ID ───────────────────────────
exports.generateTrackingId = () => uuidv4().replace(/-/g, "");

// ── Inject tracking into email HTML ───────────────
exports.injectTracking = (html, trackingId, subscriberEmail, baseUrl) => {
  const encodedEmail = encodeURIComponent(subscriberEmail);

  // Open tracking pixel
  const pixel = `<img src="${baseUrl}/api/email-tracking/open/${trackingId}/${encodedEmail}" width="1" height="1" style="display:none" alt="" />`;

  // Click tracking - wrap all links
  let tracked = html.replace(/href="(https?:\/\/[^"]+)"/g, (match, url) => {
    if (url.includes("/api/")) return match; // don't track API links
    const encoded = encodeURIComponent(url);
    return `href="${baseUrl}/api/email-tracking/click/${trackingId}/${encodedEmail}?url=${encoded}"`;
  });

  // Add pixel before closing body
  tracked = tracked.replace("</div>", `${pixel}</div>`);
  return tracked;
};

// ── Track open (pixel endpoint) ────────────────────
exports.trackOpen = async (req, res) => {
  try {
    const { trackingId, email } = req.params;

    await EmailLog.findOneAndUpdate({ trackingId }, { $inc: { opens: 1 } });

    // Update subscriber opens
    if (email) {
      await Subscriber.findOneAndUpdate(
        { email: decodeURIComponent(email) },
        { $inc: { opens: 1 } },
      );
    }
  } catch {}

  // Return 1x1 transparent gif
  const pixel = Buffer.from(
    "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
    "base64",
  );
  res.writeHead(200, {
    "Content-Type": "image/gif",
    "Content-Length": pixel.length,
    "Cache-Control": "no-cache, no-store",
    Pragma: "no-cache",
  });
  res.end(pixel);
};

// ── Track click (redirect endpoint) ───────────────
exports.trackClick = async (req, res) => {
  try {
    const { trackingId, email } = req.params;
    const { url } = req.query;

    await EmailLog.findOneAndUpdate({ trackingId }, { $inc: { clicks: 1 } });

    if (email) {
      await Subscriber.findOneAndUpdate(
        { email: decodeURIComponent(email) },
        { $inc: { clicks: 1 } },
      );
    }

    if (url) return res.redirect(decodeURIComponent(url));
  } catch {}
  res.redirect(process.env.FRONTEND_URL || "/");
};

// ── Track unsubscribe ──────────────────────────────
exports.trackUnsubscribe = async (req, res) => {
  try {
    const { trackingId, email } = req.params;
    const decoded = decodeURIComponent(email);

    await Subscriber.findOneAndUpdate(
      { email: decoded },
      { status: "unsubscribed" },
    );

    await EmailLog.findOneAndUpdate(
      { trackingId },
      { $inc: { unsubscribes: 1 } },
    );

    res.send(`
      <html>
      <head><title>Unsubscribed</title></head>
      <body style="font-family:sans-serif;max-width:500px;margin:60px auto;text-align:center;padding:24px">
        <h2 style="color:#0d9488">You've been unsubscribed</h2>
        <p style="color:#78716c">You won't receive any more emails from LegendEmpire.</p>
        <p style="color:#78716c;font-size:13px">Made a mistake? <a href="${process.env.FRONTEND_URL}/subscribe" style="color:#0d9488">Resubscribe here</a></p>
        <a href="${process.env.FRONTEND_URL}" style="display:inline-block;margin-top:20px;padding:12px 24px;background:#0d9488;color:white;border-radius:12px;text-decoration:none;font-weight:600">Visit LegendEmpire</a>
      </body>
      </html>
    `);
  } catch (err) {
    res.status(500).send("Error processing unsubscribe request.");
  }
};

// ── Admin: Get all email logs ──────────────────────
exports.getEmailLogs = async (req, res) => {
  try {
    const logs = await EmailLog.find()
      .sort({ sentAt: -1 })
      .limit(50)
      .select("-html");
    res.json({ success: true, data: logs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Admin: Get performance summary ────────────────
exports.getPerformanceSummary = async (req, res) => {
  try {
    const logs = await EmailLog.find().sort({ sentAt: -1 }).limit(10);

    const totals = await EmailLog.aggregate([
      {
        $group: {
          _id: null,
          totalSent: { $sum: "$sentTo" },
          totalOpens: { $sum: "$opens" },
          totalClicks: { $sum: "$clicks" },
          totalUnsubs: { $sum: "$unsubscribes" },
          emailCount: { $sum: 1 },
        },
      },
    ]);

    const best = await EmailLog.find({ sentTo: { $gt: 0 } })
      .sort({ opens: -1 })
      .limit(1);

    const summary = totals[0] || {};
    const avgOpenRate = summary.totalSent
      ? Math.round((summary.totalOpens / summary.totalSent) * 100)
      : 0;
    const avgClickRate = summary.totalSent
      ? Math.round((summary.totalClicks / summary.totalSent) * 100)
      : 0;

    res.json({
      success: true,
      data: {
        logs,
        summary: {
          totalEmails: summary.emailCount || 0,
          totalSent: summary.totalSent || 0,
          totalOpens: summary.totalOpens || 0,
          totalClicks: summary.totalClicks || 0,
          avgOpenRate,
          avgClickRate,
          bestSubject: best[0]?.subject || "N/A",
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
