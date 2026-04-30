const { Post, Comment } = require("../models");
const Subscriber = require("../models/Subscriber");

// ── Dashboard: Views chart (last 30 days) ──────────
exports.getViewsChart = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const since = new Date();
    since.setDate(since.getDate() - days);

    // Get all published posts
    const posts = await Post.find({ status: "published" }).select(
      "title views publishedAt createdAt",
    );

    // Build daily views from publishedAt dates as proxy
    const dailyMap = {};
    for (let i = 0; i < days; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      dailyMap[key] = 0;
    }

    posts.forEach((p) => {
      const key = (p.publishedAt || p.createdAt).toISOString().split("T")[0];
      if (dailyMap[key] !== undefined) {
        dailyMap[key] += p.views || 0;
      }
    });

    const chart = Object.entries(dailyMap)
      .map(([date, views]) => ({ date, views }))
      .sort((a, b) => a.date.localeCompare(b.date));

    res.json({ success: true, data: chart });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Top posts this week ────────────────────────────
exports.getTopPostsWeek = async (req, res) => {
  try {
    const since = new Date();
    since.setDate(since.getDate() - 7);

    const posts = await Post.find({
      status: "published",
      publishedAt: { $gte: since },
    })
      .populate("category", "name color icon")
      .select(
        "title slug views likes commentsCount publishedAt category coverImage readTime",
      )
      .sort({ views: -1 })
      .limit(10);

    // If no recent posts, fall back to all-time top
    if (posts.length === 0) {
      const allTime = await Post.find({ status: "published" })
        .populate("category", "name color icon")
        .select(
          "title slug views likes commentsCount publishedAt category coverImage readTime",
        )
        .sort({ views: -1 })
        .limit(10);
      return res.json({ success: true, data: allTime, period: "all-time" });
    }

    res.json({ success: true, data: posts, period: "week" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Subscriber growth (last 12 months) ────────────
exports.getSubscriberGrowth = async (req, res) => {
  try {
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      const count = await Subscriber.countDocuments({
        createdAt: { $gte: start, $lte: end },
        status: "active",
      });
      months.push({
        month: start.toLocaleDateString("en-US", {
          month: "short",
          year: "2-digit",
        }),
        subscribers: count,
      });
    }
    res.json({ success: true, data: months });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Popular search terms ───────────────────────────
exports.getSearchTerms = async (req, res) => {
  try {
    // Aggregate search terms stored on posts
    const terms = await Post.aggregate([
      { $unwind: "$searchTerms" },
      { $group: { _id: "$searchTerms", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]);
    res.json({ success: true, data: terms });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Traffic overview ───────────────────────────────
exports.getTrafficOverview = async (req, res) => {
  try {
    const totalPosts = await Post.countDocuments({ status: "published" });
    const totalViews = await Post.aggregate([
      { $group: { _id: null, total: { $sum: "$views" } } },
    ]);
    const totalLikes = await Post.aggregate([
      { $group: { _id: null, total: { $sum: "$likes" } } },
    ]);
    const totalComments = await Comment.countDocuments({ status: "approved" });
    const totalSubscribers = await Subscriber.countDocuments({
      status: "active",
    });

    // Category breakdown
    const { Category } = require("../models");
    const catBreakdown = await Post.aggregate([
      { $match: { status: "published" } },
      {
        $group: {
          _id: "$category",
          totalViews: { $sum: "$views" },
          postCount: { $sum: 1 },
        },
      },
      { $sort: { totalViews: -1 } },
      { $limit: 6 },
    ]);

    const categories = await Category.find({
      _id: { $in: catBreakdown.map((c) => c._id) },
    }).select("name color icon");

    const catData = catBreakdown.map((c) => {
      const cat = categories.find(
        (x) => x._id.toString() === c._id?.toString(),
      );
      return {
        name: cat?.name || "Unknown",
        icon: cat?.icon || "📁",
        color: cat?.color || "#0d9488",
        views: c.totalViews,
        postCount: c.postCount,
      };
    });

    res.json({
      success: true,
      data: {
        totalPosts,
        totalViews: totalViews[0]?.total || 0,
        totalLikes: totalLikes[0]?.total || 0,
        totalComments,
        totalSubscribers,
        categoryBreakdown: catData,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
