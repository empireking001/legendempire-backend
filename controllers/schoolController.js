const School = require("../models/School");
const Post = require("../models");

// ── Helpers ────────────────────────────────────────
const TYPE_LABELS = {
  "federal-university": "Federal University",
  "state-university": "State University",
  "private-university": "Private University",
  "federal-polytechnic": "Federal Polytechnic",
  "state-polytechnic": "State Polytechnic",
  "private-polytechnic": "Private Polytechnic",
  "college-of-education": "College of Education",
  monotechnic: "Monotechnic",
  "military-university": "Military University",
};

// ── PUBLIC: Browse all schools ─────────────────────
exports.getSchools = async (req, res) => {
  try {
    const page = +req.query.page || 1;
    const limit = +req.query.limit || 24;
    const search = req.query.search || "";
    const type = req.query.type || "";
    const state = req.query.state || "";
    const ownership = req.query.ownership || "";
    const sort = req.query.sort || "name";

    const filter = { isActive: true };
    if (type) filter.type = type;
    if (state) filter.state = state;
    if (ownership) filter.ownership = ownership;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { acronym: { $regex: search, $options: "i" } },
        { shortName: { $regex: search, $options: "i" } },
        { city: { $regex: search, $options: "i" } },
      ];
    }

    const sortObj =
      sort === "views"
        ? { views: -1 }
        : sort === "newest"
          ? { createdAt: -1 }
          : { name: 1 };

    const total = await School.countDocuments(filter);
    const schools = await School.find(filter)
      .sort(sortObj)
      .skip((page - 1) * limit)
      .limit(limit)
      .select(
        "name slug acronym shortName type ownership state city logo coverImage isFeatured views established isAccredited",
      );

    // Get post counts for each school
    const schoolIds = schools.map((s) => s._id);
    const postCounts = await Post.aggregate([
      { $match: { schools: { $in: schoolIds }, status: "published" } },
      { $unwind: "$schools" },
      { $group: { _id: "$schools", count: { $sum: 1 } } },
    ]);
    const countMap = {};
    postCounts.forEach((p) => {
      countMap[p._id.toString()] = p.count;
    });

    const enriched = schools.map((s) => ({
      ...s.toObject(),
      postCount: countMap[s._id.toString()] || 0,
      typeLabel: TYPE_LABELS[s.type] || s.type,
    }));

    // Summary stats
    const stats = {
      total,
      universities: await School.countDocuments({
        isActive: true,
        type: { $regex: "university" },
      }),
      polytechnics: await School.countDocuments({
        isActive: true,
        type: { $regex: "polytechnic" },
      }),
      colleges: await School.countDocuments({
        isActive: true,
        type: "college-of-education",
      }),
    };

    res.json({
      success: true,
      data: enriched,
      pagination: { total, page, pages: Math.ceil(total / limit), limit },
      stats,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── PUBLIC: Featured schools ───────────────────────
exports.getFeatured = async (req, res) => {
  try {
    const schools = await School.find({ isActive: true, isFeatured: true })
      .sort({ name: 1 })
      .limit(8)
      .select("name slug acronym type state city logo coverImage views");
    res.json({ success: true, data: schools });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── PUBLIC: Single school profile ─────────────────
exports.getSchool = async (req, res) => {
  try {
    const school = await School.findOne({
      slug: req.params.slug,
      isActive: true,
    });
    if (!school)
      return res
        .status(404)
        .json({ success: false, message: "School not found." });

    // Increment views
    school.views = (school.views || 0) + 1;
    await school.save({ validateBeforeSave: false });

    // Get post count
    const postCount = await Post.countDocuments({
      schools: school._id,
      status: "published",
    });

    res.json({
      success: true,
      data: {
        ...school.toObject(),
        typeLabel: TYPE_LABELS[school.type] || school.type,
        postCount,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── PUBLIC: Posts for a school ─────────────────────
exports.getSchoolPosts = async (req, res) => {
  try {
    const school = await School.findOne({
      slug: req.params.slug,
      isActive: true,
    }).select("_id name slug");
    if (!school)
      return res
        .status(404)
        .json({ success: false, message: "School not found." });

    const page = +req.query.page || 1;
    const limit = +req.query.limit || 12;
    const category = req.query.category || "";

    const filter = { schools: school._id, status: "published" };
    if (category) filter.category = category;

    const total = await Post.countDocuments(filter);
    const posts = await Post.find(filter)
      .populate("category", "name slug color icon")
      .select(
        "title slug excerpt coverImage publishedAt views readTime category",
      )
      .sort({ publishedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({
      success: true,
      data: posts,
      school: { name: school.name, slug: school.slug },
      pagination: { total, page, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── PUBLIC: Search suggestions (autocomplete) ──────
exports.searchSuggestions = async (req, res) => {
  try {
    const q = req.query.q || "";
    if (q.length < 2) return res.json({ success: true, data: [] });

    const schools = await School.find({
      isActive: true,
      $or: [
        { name: { $regex: q, $options: "i" } },
        { acronym: { $regex: q, $options: "i" } },
        { shortName: { $regex: q, $options: "i" } },
      ],
    })
      .select("name slug acronym type state logo")
      .limit(6);

    res.json({ success: true, data: schools });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── ADMIN: Get all schools ─────────────────────────
exports.adminGetSchools = async (req, res) => {
  try {
    const page = +req.query.page || 1;
    const limit = +req.query.limit || 30;
    const search = req.query.search || "";

    const filter = {};
    if (search)
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { acronym: { $regex: search, $options: "i" } },
        { state: { $regex: search, $options: "i" } },
      ];

    const total = await School.countDocuments(filter);
    const schools = await School.find(filter)
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({
      success: true,
      data: schools,
      pagination: { total, page, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── ADMIN: Create school ───────────────────────────
exports.createSchool = async (req, res) => {
  try {
    const school = await School.create(req.body);
    res
      .status(201)
      .json({ success: true, data: school, message: `${school.name} added!` });
  } catch (err) {
    if (err.code === 11000)
      return res
        .status(400)
        .json({
          success: false,
          message: "A school with this name/slug already exists.",
        });
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── ADMIN: Update school ───────────────────────────
exports.updateSchool = async (req, res) => {
  try {
    const school = await School.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!school)
      return res
        .status(404)
        .json({ success: false, message: "School not found." });
    res.json({ success: true, data: school, message: "School updated!" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── ADMIN: Delete school ───────────────────────────
exports.deleteSchool = async (req, res) => {
  try {
    const school = await School.findByIdAndDelete(req.params.id);
    if (!school)
      return res.status(404).json({ success: false, message: "Not found." });
    // Remove school reference from all posts
    await Post.updateMany(
      { schools: school._id },
      { $pull: { schools: school._id } },
    );
    res.json({ success: true, message: `${school.name} deleted.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── ADMIN: Toggle featured ─────────────────────────
exports.toggleFeatured = async (req, res) => {
  try {
    const school = await School.findById(req.params.id);
    if (!school)
      return res.status(404).json({ success: false, message: "Not found." });
    school.isFeatured = !school.isFeatured;
    await school.save();
    res.json({ success: true, isFeatured: school.isFeatured });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── ADMIN: Stats ───────────────────────────────────
exports.adminStats = async (req, res) => {
  try {
    const total = await School.countDocuments();
    const active = await School.countDocuments({ isActive: true });
    const featured = await School.countDocuments({ isFeatured: true });
    const byType = await School.aggregate([
      { $group: { _id: "$type", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    const byState = await School.aggregate([
      { $group: { _id: "$state", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);
    res.json({
      success: true,
      data: { total, active, featured, byType, byState },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
