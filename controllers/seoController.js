const { Post, Category, SiteSettings } = require("../models");

// ── GET site settings ──────────────────────────────
async function getSettings() {
  let s = await SiteSettings.findOne({ singleton: "settings" });
  if (!s) s = await SiteSettings.create({ singleton: "settings" });
  return s;
}

exports.getSettings = async (req, res) => {
  try {
    const s = await getSettings();
    res.json({ success: true, data: s });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.saveSettings = async (req, res) => {
  try {
    const s = await getSettings();
    const allowed = [
      "adsenseEnabled",
      "adsenseId",
      "adSlotHeader",
      "adSlotSidebar",
      "adSlotInArticle",
      "adSlotFooter",
      "robotsTxt",
      "googleVerification",
      "defaultOgImage",
      "maintenanceMode",
    ];
    allowed.forEach((f) => {
      if (req.body[f] !== undefined) s[f] = req.body[f];
    });
    await s.save();
    res.json({ success: true, message: "Settings saved!" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── XML Sitemap ────────────────────────────────────
exports.getSitemap = async (req, res) => {
  try {
    const siteUrl =
      process.env.FRONTEND_URL || "https://legendempire.vercel.app";
    const posts = await Post.find({ status: "published" })
      .select("slug updatedAt publishedAt")
      .sort({ publishedAt: -1 });
    const categories = await Category.find({ isActive: true }).select(
      "slug updatedAt",
    );

    const staticPages = ["", "about", "contact", "privacy", "disclaimer"];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

    staticPages.forEach((page) => {
      xml += `
  <url>
    <loc>${siteUrl}/${page}</loc>
    <changefreq>weekly</changefreq>
    <priority>${page === "" ? "1.0" : "0.5"}</priority>
  </url>`;
    });

    categories.forEach((cat) => {
      xml += `
  <url>
    <loc>${siteUrl}/category/${cat.slug}</loc>
    <lastmod>${(cat.updatedAt || new Date()).toISOString().split("T")[0]}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`;
    });

    posts.forEach((post) => {
      xml += `
  <url>
    <loc>${siteUrl}/post/${post.slug}</loc>
    <lastmod>${(post.updatedAt || post.publishedAt || new Date()).toISOString().split("T")[0]}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`;
    });

    xml += "\n</urlset>";

    res.setHeader("Content-Type", "application/xml");
    res.send(xml);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Robots.txt ─────────────────────────────────────
exports.getRobots = async (req, res) => {
  try {
    const s = await getSettings();
    res.setHeader("Content-Type", "text/plain");
    res.send(s.robotsTxt);
  } catch (err) {
    res.status(500).send("User-agent: *\nAllow: /");
  }
};
