const ForumQuestion = require("../models/ForumQuestion");
const School = require("../models/School");

// =========================================================================
// ── PUBLIC ENDPOINTS (NO AUTH REQUIRED) ──────────────────────────────────
// =========================================================================

// ── PUBLIC: Ask a question (General or bound to a school) ──
exports.createQuestion = async (req, res) => {
  try {
    const { title, content, author, email, category, tags, schoolId } =
      req.body;

    // Fallback title handling for campus questions that only submit direct text
    const cleanTitle =
      title?.trim() || content?.trim().substring(0, 60) + "...";

    if (!content?.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Content required." });
    }

    // Validate school link if provided
    if (schoolId) {
      const schoolExists = await School.findById(schoolId);
      if (!schoolExists) {
        return res
          .status(404)
          .json({ success: false, message: "Linked school not found." });
      }
    }

    const q = await ForumQuestion.create({
      title: cleanTitle,
      content: content.trim(),
      author: author?.trim() || "Anonymous Student", // Default to Anonymous Student
      email: email?.trim() || "",
      category: category || (schoolId ? "education" : "general"),
      school: schoolId || null,
      isApproved: false, // Explicitly false! Requires admin panel approval to show on timeline
      tags: tags
        ? tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : [],
    });

    res.status(201).json({
      success: true,
      data: q,
      message: "Question submitted for approval successfully! 🚀",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── PUBLIC: Get all approved general forum questions ──
exports.getQuestions = async (req, res) => {
  try {
    const page = +req.query.page || 1;
    const limit = +req.query.limit || 20;
    const category = req.query.category || "";
    const search = req.query.search || "";
    const sort = req.query.sort || "latest";

    const filter = { isApproved: true, school: null };
    if (category) filter.category = category;

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { content: { $regex: search, $options: "i" } },
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
      data: questions, // ✅ FIXED: Changed from 'q' to 'questions'
      pagination: { total, page, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── PUBLIC: Get approved forum questions explicitly by School Slug ──
exports.getSchoolForum = async (req, res) => {
  try {
    const { slug } = req.params;
    const school = await School.findOne({ slug, isActive: true });
    if (!school) {
      return res
        .status(404)
        .json({ success: false, message: "School not found." });
    }

    const page = +req.query.page || 1;
    const limit = +req.query.limit || 20;

    // Filters for approved questions matching this specific school instance
    const filter = { school: school._id, isApproved: true };

    const total = await ForumQuestion.countDocuments(filter);
    const questions = await ForumQuestion.find(filter)
      .sort({ isPinned: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select("-answers.email -email");

    res.json({
      success: true,
      school: { name: school.name, acronym: school.acronym, slug: school.slug },
      data: questions,
      pagination: { total, page, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── PUBLIC: Get single question by slug ──
exports.getQuestion = async (req, res) => {
  try {
    const q = await ForumQuestion.findOne({
      slug: req.params.slug,
      isApproved: true,
    })
      .populate("school", "name acronym slug logo")
      .select("-email");

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

// ── PUBLIC: Answer a question ──
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
      author: author?.trim() || "Anonymous Student",
      email: email?.trim() || "",
      isAdmin: false,
    });

    if (q.status === "open") q.status = "answered";
    await q.save();
    res.json({
      success: true,
      message: "Answer posted successfully!",
      data: q,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── PUBLIC: Upvote question ──
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

// =========================================================================
// ── ADMIN ENDPOINTS (REQUIRES ADMIN AUTHENTICATION MIDDLEWARE) ───────────
// =========================================================================

// ── ADMIN Tab A: Get all questions belonging to the General Forum (school is null) ──
exports.adminGetGeneralQuestions = async (req, res) => {
  try {
    const qs = await ForumQuestion.find({ school: null })
      .sort({ createdAt: -1 })
      .limit(150);
    res.json({ success: true, data: qs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── ADMIN Tab B: Get all questions belonging specifically to School Campuses ──
exports.adminGetCampusQuestions = async (req, res) => {
  try {
    const qs = await ForumQuestion.find({ school: { $ne: null } })
      .populate("school", "name acronym")
      .sort({ createdAt: -1 })
      .limit(150);

    // Format properties dynamically so frontend handles q.title and q.schoolName uniformly
    const formattedData = qs.map((q) => ({
      ...q._doc,
      schoolName: q.school?.acronym || q.school?.name || "Campus",
    }));

    res.json({ success: true, data: formattedData });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── ADMIN: Approve a pending student submission ──
exports.adminApproveQuestion = async (req, res) => {
  try {
    const q = await ForumQuestion.findById(req.params.id);
    if (!q)
      return res
        .status(404)
        .json({ success: false, message: "Question target not found." });

    q.isApproved = true;
    await q.save();
    res.json({
      success: true,
      message: "Question approved for public view! ✅",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── ADMIN: Answer and automatically approve question entry ──
exports.adminAnswer = async (req, res) => {
  try {
    const { content } = req.body;
    const q = await ForumQuestion.findById(req.params.id);
    if (!q)
      return res.status(404).json({ success: false, message: "Not found." });

    q.answers.unshift({
      content: content.trim(),
      author: req.user?.name || "LegendEmpire Team",
      isAdmin: true,
    });

    q.status = "answered";
    q.isApproved = true; // Auto-approve if the admin provides an answer directly!
    await q.save();

    res.json({ success: true, message: "Admin response posted!", data: q });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── ADMIN: Toggle pin ──
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

// ── ADMIN: Delete question ──
exports.deleteQuestion = async (req, res) => {
  try {
    await ForumQuestion.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Question deleted successfully." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
