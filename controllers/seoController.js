const { Post, Category, SiteSettings } = require("../models");
const School = require("../models/School");

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

    const schools = await School.find({ isActive: true }).select(
      "slug updatedAt",
    );
    schools.forEach((school) => {
      xml += `
  <url>
    <loc>${siteUrl}/schools/${school.slug}</loc>
    <lastmod>${(school.updatedAt || new Date()).toISOString().split("T")[0]}</lastmod>
    <changefreq>weekly</changefreq>
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

// ── Broken Link Checker ────────────────────────────
exports.checkBrokenLinks = async (req, res) => {
  try {
    const { Post } = require('../models');
    const posts = await Post.find({ status: 'published' })
      .select('title slug content').limit(20);

    const results = [];

    for (const post of posts) {
      // Extract external URLs from content
      const urlRegex = /href="(https?:\/\/[^"]+)"/g;
      const urls     = [];
      let match;
      while ((match = urlRegex.exec(post.content)) !== null) {
        if (!match[1].includes('legendempire')) urls.push(match[1]);
      }

      const checked = await Promise.all(
        urls.slice(0, 5).map(async url => {
          try {
            const controller = new AbortController();
            const timeout    = setTimeout(() => controller.abort(), 8000);
            const r = await fetch(url, {
              method:  'HEAD',
              signal:  controller.signal,
              headers: { 'User-Agent': 'LegendEmpireLinkChecker/1.0' },
            });
            clearTimeout(timeout);
            return { url, status: r.status, ok: r.ok };
          } catch {
            return { url, status: 0, ok: false, error: 'Unreachable' };
          }
        })
      );

      const broken = checked.filter(c => !c.ok);
      if (broken.length > 0) {
        results.push({ post: { title: post.title, slug: post.slug }, broken });
      }
    }

    res.json({ success: true, data: results, checked: posts.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Content Refresh Reminder ───────────────────────
exports.getStaleContent = async (req, res) => {
  try {
    const { Post } = require('../models');
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const stale = await Post.find({
      status:    'published',
      updatedAt: { $lt: sixMonthsAgo },
    })
      .select('title slug views updatedAt publishedAt category')
      .populate('category', 'name color icon')
      .sort({ views: -1 })
      .limit(20);

    res.json({ success: true, data: stale });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};