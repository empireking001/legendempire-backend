const jwt              = require('jsonwebtoken');
const { User, Category, Post, Comment } = require('../models');
const cloudinary       = require('../config/cloudinary');

const signToken = id => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });

// ════════════════════════════════════════════
// AUTH CONTROLLERS
// ════════════════════════════════════════════

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password required.' });
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.matchPassword(password)))
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });
    res.json({ success: true, token: signToken(user._id), user: { id: user._id, name: user.name, email: user.email, role: user.role, avatar: user.avatar } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.getMe = async (req, res) => {
  const user = await User.findById(req.user.id);
  res.json({ success: true, user });
};

exports.updateProfile = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.user.id, { name: req.body.name, bio: req.body.bio }, { new: true });
    res.json({ success: true, user });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.changePassword = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('+password');
    if (!(await user.matchPassword(req.body.currentPassword)))
      return res.status(400).json({ success: false, message: 'Current password incorrect.' });
    user.password = req.body.newPassword;
    await user.save();
    res.json({ success: true, message: 'Password updated.' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// ════════════════════════════════════════════
// CATEGORY CONTROLLERS
// ════════════════════════════════════════════

exports.getCategories = async (req, res) => {
  try {
    const cats = await Category.find({ isActive: true }).sort({ order: 1, name: 1 });
    res.json({ success: true, data: cats });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.adminGetCategories = async (req, res) => {
  try {
    const cats = await Category.find().sort({ order: 1, name: 1 });
    res.json({ success: true, data: cats });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.getCategoryBySlug = async (req, res) => {
  try {
    const cat = await Category.findOne({ slug: req.params.slug, isActive: true });
    if (!cat) return res.status(404).json({ success: false, message: 'Category not found.' });
    const page  = +req.query.page  || 1;
    const limit = +req.query.limit || 12;
    const total = await Post.countDocuments({ category: cat._id, status: 'published' });
    const posts = await Post.find({ category: cat._id, status: 'published' })
      .populate('author', 'name avatar').select('-content -likedBy')
      .sort({ publishedAt: -1 }).skip((page-1)*limit).limit(limit);
    res.json({ success: true, data: { category: cat, posts }, pagination: { total, page, pages: Math.ceil(total/limit) } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.createCategory = async (req, res) => {
  try {
    const slugify = require('slugify');
    const data = { ...req.body, slug: slugify(req.body.name, { lower: true, strict: true }) };
    const cat = await Category.create(data);
    res.status(201).json({ success: true, data: cat, message: 'Category created.' });
  } catch (e) {
    if (e.code === 11000) return res.status(400).json({ success: false, message: 'Category name already exists.' });
    res.status(500).json({ success: false, message: e.message });
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const cat = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!cat) return res.status(404).json({ success: false, message: 'Not found.' });
    res.json({ success: true, data: cat, message: 'Category updated.' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.deleteCategory = async (req, res) => {
  try {
    const count = await Post.countDocuments({ category: req.params.id });
    if (count > 0) return res.status(400).json({ success: false, message: `Cannot delete — ${count} post(s) use this category.` });
    await Category.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Category deleted.' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// ════════════════════════════════════════════
// POST CONTROLLERS
// ════════════════════════════════════════════

exports.getPosts = async (req, res) => {
  try {
    const page  = +req.query.page  || 1;
    const limit = +req.query.limit || 10;
    let query   = { status: 'published' };
    if (req.query.category) {
      const cat = await Category.findOne({ slug: req.query.category });
      if (cat) query.category = cat._id;
    }
    if (req.query.search) query.$text = { $search: req.query.search };
    if (req.query.tag)    query.tags   = req.query.tag.toLowerCase();
    const total = await Post.countDocuments(query);
    const posts = await Post.find(query)
      .populate('category', 'name slug color icon')
      .populate('author', 'name avatar')
      .select('-content -likedBy')
      .sort({ publishedAt: -1 }).skip((page-1)*limit).limit(limit);
    res.json({ success: true, data: posts, pagination: { total, page, pages: Math.ceil(total/limit) } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.getFeatured = async (req, res) => {
  try {
    let post = await Post.findOne({ status: 'published', isFeatured: true })
      .populate('category', 'name slug color icon').populate('author', 'name avatar').sort({ publishedAt: -1 });
    if (!post) post = await Post.findOne({ status: 'published' })
      .populate('category', 'name slug color icon').populate('author', 'name avatar').sort({ publishedAt: -1 });
    res.json({ success: true, data: post });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.getHomepage = async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true }).sort({ order: 1 });
    const result = {};
    for (const cat of categories) {
      const posts = await Post.find({ status: 'published', category: cat._id })
        .populate('author', 'name').select('title slug excerpt coverImage publishedAt views readTime')
        .sort({ publishedAt: -1 }).limit(6);
      if (posts.length > 0) result[cat.slug] = { category: cat, posts };
    }
    res.json({ success: true, data: result });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.getTrending = async (req, res) => {
  try {
    const posts = await Post.find({ status: 'published' })
      .populate('category', 'name slug color').select('title slug coverImage views publishedAt readTime')
      .sort({ views: -1 }).limit(6);
    res.json({ success: true, data: posts });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.getPostBySlug = async (req, res) => {
  try {
    const post = await Post.findOne({ slug: req.params.slug, status: 'published' })
      .populate('category', 'name slug color icon').populate('author', 'name avatar bio');
    if (!post) return res.status(404).json({ success: false, message: 'Post not found.' });
    await Post.findByIdAndUpdate(post._id, { $inc: { views: 1 } });
    const related = await Post.find({ category: post.category._id, _id: { $ne: post._id }, status: 'published' })
      .select('title slug coverImage publishedAt readTime').limit(3);
    res.json({ success: true, data: post, related });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.likePost = async (req, res) => {
  try {
    const ip   = req.ip || 'unknown';
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Not found.' });
    const liked = post.likedBy.includes(ip);
    if (liked) { post.likedBy = post.likedBy.filter(a => a !== ip); post.likes = Math.max(0, post.likes - 1); }
    else        { post.likedBy.push(ip); post.likes += 1; }
    await post.save();
    res.json({ success: true, liked: !liked, likes: post.likes });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.reactPost = async (req, res) => {
  try {
    const { reaction } = req.body;
    const allowed = ["fire", "mindblown", "hundred", "pray"];
    if (!allowed.includes(reaction))
      return res
        .status(400)
        .json({ success: false, message: "Invalid reaction." });

    const ip = req.ip || "unknown";
    const key = `reaction_${reaction}`;
    const post = await Post.findById(req.params.id);
    if (!post)
      return res.status(404).json({ success: false, message: "Not found." });

    const inc = {};
    inc[`reactions.${reaction}`] = 1;
    await Post.findByIdAndUpdate(req.params.id, { $inc: inc });
    const updated = await Post.findById(req.params.id);
    res.json({ success: true, reactions: updated.reactions });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};
exports.adminGetPosts = async (req, res) => {
  try {
    const page = +req.query.page || 1, limit = +req.query.limit || 20;
    let q = {};
    if (req.query.status)   q.status   = req.query.status;
    if (req.query.category) q.category = req.query.category;
    const total = await Post.countDocuments(q);
    const posts = await Post.find(q)
      .populate('category', 'name slug color').populate('author', 'name')
      .select('-content -likedBy').sort({ updatedAt: -1 }).skip((page-1)*limit).limit(limit);
    res.json({ success: true, data: posts, pagination: { total, page, pages: Math.ceil(total/limit) } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.adminGetStats = async (req, res) => {
  try {
    const [totalPosts, published, drafts, viewsAgg, totalComments, pending, recent] = await Promise.all([
      Post.countDocuments(),
      Post.countDocuments({ status: 'published' }),
      Post.countDocuments({ status: 'draft' }),
      Post.aggregate([{ $group: { _id: null, total: { $sum: '$views' } } }]),
      Comment.countDocuments(),
      Comment.countDocuments({ status: 'pending' }),
      Post.find().populate('category', 'name color').select('title slug status views publishedAt createdAt').sort({ createdAt: -1 }).limit(5),
    ]);
    res.json({ success: true, data: { totalPosts, published, drafts, totalViews: viewsAgg[0]?.total || 0, totalComments, pending, recent } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.createPost = async (req, res) => {
  try {
    const data = { ...req.body, author: req.user.id };
    if (req.body.tags && typeof req.body.tags === "string")
      data.tags = req.body.tags
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);

    // Handle scheduler: if scheduledAt is set, keep as draft until then
    if (data.scheduledAt && new Date(data.scheduledAt) > new Date()) {
      data.status = "draft";
    }

    const post = await Post.create(data);
    if (post.status === "published")
      await Category.findByIdAndUpdate(post.category, {
        $inc: { postCount: 1 },
      });

    const populated = await Post.findById(post._id)
      .populate("category", "name slug color")
      .populate("author", "name");
    res
      .status(201)
      .json({ success: true, data: populated, message: "Post created!" });
  } catch (err) {
    if (err.name === "ValidationError")
      return res.status(400).json({
        success: false,
        message: Object.values(err.errors)
          .map((x) => x.message)
          .join(", "),
      });
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Duplicate post ─────────────────────────────────
exports.duplicatePost = async (req, res) => {
  try {
    const original = await Post.findById(req.params.id);
    if (!original)
      return res
        .status(404)
        .json({ success: false, message: "Post not found." });

    const {
      _id,
      slug,
      createdAt,
      updatedAt,
      publishedAt,
      views,
      likes,
      likedBy,
      commentsCount,
      ...rest
    } = original.toObject();

    const duplicate = await Post.create({
      ...rest,
      title: `${original.title} (Copy)`,
      slug: undefined, // will be auto-generated
      status: "draft",
      isFeatured: false,
      views: 0,
      likes: 0,
      likedBy: [],
      commentsCount: 0,
      author: req.user.id,
    });

    const populated = await Post.findById(duplicate._id)
      .populate("category", "name slug color")
      .populate("author", "name");

    res
      .status(201)
      .json({
        success: true,
        data: populated,
        message: "Post duplicated as draft!",
      });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updatePost = async (req, res) => {
  try {
    const old = await Post.findById(req.params.id);
    if (!old) return res.status(404).json({ success: false, message: 'Not found.' });
    const data = { ...req.body };
    if (req.body.tags && typeof req.body.tags === 'string')
      data.tags = req.body.tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
    const post = await Post.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true })
      .populate('category', 'name slug color').populate('author', 'name');
    if (old.status !== post.status) {
      if (post.status === 'published') await Category.findByIdAndUpdate(post.category, { $inc: { postCount: 1 } });
      else                             await Category.findByIdAndUpdate(post.category, { $inc: { postCount: -1 } });
    }
    res.json({ success: true, data: post, message: 'Post updated!' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Not found.' });
    if (post.coverImageId) {
      try { await cloudinary.uploader.destroy(post.coverImageId); } catch {}
    }
    if (post.status === 'published') await Category.findByIdAndUpdate(post.category, { $inc: { postCount: -1 } });
    await Comment.deleteMany({ post: post._id });
    await post.deleteOne();
    res.json({ success: true, message: 'Post deleted.' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.featurePost = async (req, res) => {
  try {
    await Post.updateMany({}, { isFeatured: false });
    const post = await Post.findByIdAndUpdate(req.params.id, { isFeatured: true }, { new: true });
    res.json({ success: true, data: post, message: 'Featured post set.' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// ════════════════════════════════════════════
// COMMENT CONTROLLERS
// ════════════════════════════════════════════

exports.getComments = async (req, res) => {
  try {
    const comments = await Comment.find({ post: req.params.postId, status: 'approved', parent: null })
      .sort({ createdAt: -1 });
    const withReplies = await Promise.all(comments.map(async c => {
      const replies = await Comment.find({ parent: c._id, status: 'approved' }).sort({ createdAt: 1 });
      return { ...c.toObject(), replies };
    }));
    res.json({ success: true, data: withReplies });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.createComment = async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post || post.status !== 'published') return res.status(404).json({ success: false, message: 'Post not found.' });
    const { name, email, content, parent } = req.body;
    if (!name || !email || !content) return res.status(400).json({ success: false, message: 'All fields required.' });
    const comment = await Comment.create({ post: req.params.postId, name: name.trim(), email: email.toLowerCase().trim(), content: content.trim(), parent: parent || null, ipAddress: req.ip });
    res.status(201).json({ success: true, data: comment, message: 'Comment submitted for review.' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.adminGetComments = async (req, res) => {
  try {
    const q = req.query.status === 'all' ? {} : { status: req.query.status || 'pending' };
    const comments = await Comment.find(q).populate('post', 'title slug').sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, data: comments });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.moderateComment = async (req, res) => {
  try {
    const { action } = req.params; // approve | reject
    const status = action === 'approve' ? 'approved' : 'rejected';
    const c = await Comment.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!c) return res.status(404).json({ success: false, message: 'Not found.' });
    if (status === 'approved') await Post.findByIdAndUpdate(c.post, { $inc: { commentsCount: 1 } });
    res.json({ success: true, message: `Comment ${action}d.` });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.deleteComment = async (req, res) => {
  try {
    const c = await Comment.findById(req.params.id);
    if (!c) return res.status(404).json({ success: false, message: 'Not found.' });
    if (c.status === 'approved') await Post.findByIdAndUpdate(c.post, { $inc: { commentsCount: -1 } });
    await c.deleteOne();
    res.json({ success: true, message: 'Comment deleted.' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// ════════════════════════════════════════════
// UPLOAD CONTROLLER (Cloudinary)
// ════════════════════════════════════════════

exports.uploadImage = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });
    res.json({
      success: true,
      url:       req.file.path,
      public_id: req.file.filename,
      message:   'Image uploaded to Cloudinary.',
    });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.deleteImage = async (req, res) => {
  try {
    const { public_id } = req.body;
    if (!public_id) return res.status(400).json({ success: false, message: 'public_id required.' });
    await cloudinary.uploader.destroy(public_id);
    res.json({ success: true, message: 'Image deleted.' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// ── ADMIN: Get all admins ──────────────────────────
exports.getAdmins = async (req, res) => {
  try {
    const admins = await User.find().select('-password').sort({ createdAt: 1 });
    res.json({ success: true, data: admins });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// ── ADMIN: Add new admin/editor ────────────────────
exports.addAdmin = async (req, res) => {
  try {
    const { name, email, password, role, permissions } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ success: false, message: 'Name, email and password required.' });
    if (password.length < 8)
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
    const exists = await User.findOne({ email: email.toLowerCase().trim() });
    if (exists)
      return res.status(400).json({ success: false, message: 'An account with this email already exists.' });
    const user = await User.create({
      name, email, password,
      role:        role || 'admin',
      permissions: permissions || ['posts', 'categories', 'comments'],
      addedBy:     req.user.id,
    });
    res.status(201).json({ success: true, message: `${name} added as ${role || 'admin'}.`, data: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (e) {
    if (e.code === 11000) return res.status(400).json({ success: false, message: 'Email already in use.' });
    res.status(500).json({ success: false, message: e.message });
  }
};

// ── ADMIN: Remove admin ────────────────────────────
exports.removeAdmin = async (req, res) => {
  try {
    if (req.params.id === req.user.id.toString())
      return res.status(400).json({ success: false, message: 'You cannot remove your own account.' });
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Admin removed.' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};