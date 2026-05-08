const ForumQuestion = require("../models/ForumQuestion");

// ── PUBLIC: Get all questions ──────────────────────
exports.getQuestions = async (req, res) => {
  try {
    const page = +req.query.page || 1;
    const limit = +req.query.limit || 20;
    const category = req.query.category || "";
    const search = req.query.search || "";
    const sort = req.query.sort || "latest";

    const filter = { isApproved: true };
    if (category) filter.category = category;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { content: { $regex: search, $options: "i" } },
        { tags: { $in: [new RegExp(search, "i")] } },
      ];
    }

    const sortObj =
      sort === "popular"
        ? { upvotes: -1, views: -1 }
        : sort === "unanswered"
          ? { "answers.0": 1, createdAt: -1 }
          : { isPinned: -1, createdAt: -1 };

    const total = await ForumQuestion.countDocuments(filter);
    const questions = await ForumQuestion.find(filter)
      .sort(sortObj)
      .skip((page - 1) * limit)
      .limit(limit)
      .select("-answers.email -email");

    res.json({
      success: true,
      data: questions,
      pagination: { total, page, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── PUBLIC: Get single question ────────────────────
exports.getQuestion = async (req, res) => {
  try {
    const q = await ForumQuestion.findOne({
      slug: req.params.slug,
      isApproved: true,
    }).select("-email");

    if (!q)
      return res
        .status(404)
        .json({ success: false, message: "Question not found." });
    q.views += 1;
    await q.save();
    res.json({ success: true, data: q });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── PUBLIC: Ask a question ─────────────────────────
exports.createQuestion = async (req, res) => {
  try {
    const { title, content, author, email, category, tags } = req.body;
    if (!title?.trim() || !content?.trim())
      return res
        .status(400)
        .json({ success: false, message: "Title and content required." });

    const q = await ForumQuestion.create({
      title: title.trim(),
      content: content.trim(),
      author: author?.trim() || "Anonymous",
      email: email?.trim() || "",
      category: category || "general",
      tags: tags
        ? tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : [],
    });

    res
      .status(201)
      .json({ success: true, data: q, message: "Question posted!" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── PUBLIC: Answer a question ──────────────────────
exports.addAnswer = async (req, res) => {
  try {
    const { content, author, email } = req.body;
    if (!content?.trim())
      return res
        .status(400)
        .json({ success: false, message: "Answer content required." });

    const q = await ForumQuestion.findById(req.params.id);
    if (!q)
      return res
        .status(404)
        .json({ success: false, message: "Question not found." });

    q.answers.push({
      content: content.trim(),
      author: author?.trim() || "Anonymous",
      email: email?.trim() || "",
      isAdmin: false,
    });

    if (q.status === "open") q.status = "answered";
    await q.save();
    res.json({ success: true, message: "Answer posted!", data: q });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── PUBLIC: Upvote question ────────────────────────
exports.upvoteQuestion = async (req, res) => {
  try {
    const ip = req.ip || "unknown";
    const q = await ForumQuestion.findById(req.params.id);
    if (!q)
      return res.status(404).json({ success: false, message: "Not found." });

    if (q.upvotedBy.includes(ip)) {
      q.upvotedBy = q.upvotedBy.filter((x) => x !== ip);
      q.upvotes = Math.max(0, q.upvotes - 1);
    } else {
      q.upvotedBy.push(ip);
      q.upvotes += 1;
    }
    await q.save();
    res.json({ success: true, upvotes: q.upvotes });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── ADMIN: Get all questions ───────────────────────
exports.adminGetQuestions = async (req, res) => {
  try {
    const qs = await ForumQuestion.find().sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, data: qs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── ADMIN: Answer as admin ────────────────────────
exports.adminAnswer = async (req, res) => {
  try {
    const { content } = req.body;
    const q = await ForumQuestion.findById(req.params.id);
    if (!q)
      return res.status(404).json({ success: false, message: "Not found." });

    q.answers.unshift({
      content: content.trim(),
      author: req.user.name || "LegendEmpire Team",
      isAdmin: true,
    });
    q.status = "answered";
    await q.save();
    res.json({ success: true, message: "Admin answer posted!", data: q });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── ADMIN: Toggle pin ──────────────────────────────
exports.togglePin = async (req, res) => {
  try {
    const q = await ForumQuestion.findById(req.params.id);
    if (!q)
      return res.status(404).json({ success: false, message: "Not found." });
    q.isPinned = !q.isPinned;
    await q.save();
    res.json({ success: true, isPinned: q.isPinned });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── ADMIN: Delete question ─────────────────────────
exports.deleteQuestion = async (req, res) => {
  try {
    await ForumQuestion.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Question deleted." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
