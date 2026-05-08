const { Post } = require("../models");
const EmailConfig = require("../models/EmailConfig");

// ── Send to Telegram channel ───────────────────────
async function sendToTelegram(text, botToken, chatId) {
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: false,
        }),
      },
    );
    const data = await res.json();
    return data.ok;
  } catch (err) {
    console.error("Telegram send error:", err.message);
    return false;
  }
}

// ── Auto-post when a post is published ────────────
exports.autoPostToTelegram = async (post) => {
  try {
    const cfg = await EmailConfig.findOne({ singleton: "config" });
    if (!cfg?.telegramBotToken || !cfg?.telegramChatId) return;

    const siteUrl =
      process.env.FRONTEND_URL || "https://legendempire.vercel.app";
    const text = `🔥 <b>${post.title}</b>\n\n${post.excerpt?.substring(0, 150) || ""}...\n\n📖 Read more: ${siteUrl}/post/${post.slug}\n\n#LegendEmpire #${post.category?.name?.replace(/\s+/g, "") || "Nigeria"}`;

    await sendToTelegram(text, cfg.telegramBotToken, cfg.telegramChatId);
  } catch (err) {
    console.error("Auto Telegram post error:", err.message);
  }
};

// ── Manual post to Telegram ────────────────────────
exports.sendManual = async (req, res) => {
  try {
    const cfg = await EmailConfig.findOne({ singleton: "config" });
    if (!cfg?.telegramBotToken || !cfg?.telegramChatId)
      return res
        .status(400)
        .json({
          success: false,
          message:
            "Configure Telegram Bot Token and Chat ID in Newsletter → SMTP Settings first.",
        });

    const { text, postId } = req.body;
    let message = text;

    if (!message && postId) {
      const post = await Post.findById(postId).populate("category", "name");
      if (!post)
        return res
          .status(404)
          .json({ success: false, message: "Post not found." });
      const siteUrl =
        process.env.FRONTEND_URL || "https://legendempire.vercel.app";
      message = `🔥 <b>${post.title}</b>\n\n${post.excerpt?.substring(0, 200) || ""}...\n\n📖 ${siteUrl}/post/${post.slug}`;
    }

    if (!message)
      return res
        .status(400)
        .json({ success: false, message: "Provide text or postId." });

    const ok = await sendToTelegram(
      message,
      cfg.telegramBotToken,
      cfg.telegramChatId,
    );
    if (ok) res.json({ success: true, message: "Posted to Telegram channel!" });
    else
      res
        .status(500)
        .json({
          success: false,
          message: "Failed. Check your Bot Token and Chat ID.",
        });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Weekly roundup ─────────────────────────────────
exports.weeklyRoundup = async (req, res) => {
  try {
    const cfg = await EmailConfig.findOne({ singleton: "config" });
    if (!cfg?.telegramBotToken || !cfg?.telegramChatId)
      return res
        .status(400)
        .json({ success: false, message: "Telegram not configured." });

    const since = new Date();
    since.setDate(since.getDate() - 7);

    const posts = await Post.find({
      status: "published",
      publishedAt: { $gte: since },
    })
      .populate("category", "name")
      .sort({ views: -1 })
      .limit(5);

    if (posts.length === 0)
      return res
        .status(400)
        .json({ success: false, message: "No posts from this week." });

    const siteUrl =
      process.env.FRONTEND_URL || "https://legendempire.vercel.app";
    const postList = posts
      .map(
        (p, i) =>
          `${i + 1}. <a href="${siteUrl}/post/${p.slug}">${p.title}</a>`,
      )
      .join("\n");

    const text = `📰 <b>LegendEmpire Weekly Roundup</b>\n\nTop stories this week:\n\n${postList}\n\n🔗 <a href="${siteUrl}">Read all articles</a>\n\n#LegendEmpire #WeeklyRoundup`;

    const ok = await sendToTelegram(
      text,
      cfg.telegramBotToken,
      cfg.telegramChatId,
    );
    if (ok)
      res.json({ success: true, message: "Weekly roundup sent to Telegram!" });
    else res.status(500).json({ success: false, message: "Failed to send." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
