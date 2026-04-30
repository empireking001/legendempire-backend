const { PostRevision, Post } = require("../models");

exports.getRevisions = async (req, res) => {
  try {
    const revisions = await PostRevision.find({ post: req.params.postId })
      .populate("savedBy", "name")
      .sort({ createdAt: -1 })
      .limit(20);
    res.json({ success: true, data: revisions });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.saveRevision = async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post)
      return res
        .status(404)
        .json({ success: false, message: "Post not found." });

    const count = await PostRevision.countDocuments({ post: post._id });

    const revision = await PostRevision.create({
      post: post._id,
      content: post.content,
      title: post.title,
      savedBy: req.user.id,
      version: count + 1,
      note: req.body.note || "Manual save",
    });

    res
      .status(201)
      .json({ success: true, data: revision, message: "Revision saved." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.restoreRevision = async (req, res) => {
  try {
    const revision = await PostRevision.findById(req.params.revisionId);
    if (!revision)
      return res
        .status(404)
        .json({ success: false, message: "Revision not found." });

    const post = await Post.findByIdAndUpdate(
      revision.post,
      { content: revision.content, title: revision.title },
      { new: true },
    )
      .populate("category", "name slug color")
      .populate("author", "name");

    res.json({
      success: true,
      data: post,
      message: `Restored to version ${revision.version}.`,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteRevision = async (req, res) => {
  try {
    await PostRevision.findByIdAndDelete(req.params.revisionId);
    res.json({ success: true, message: "Revision deleted." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Auto-save from editor (upsert)
exports.autoSave = async (req, res) => {
  try {
    const { title, content } = req.body;
    const post = await Post.findById(req.params.postId);
    if (!post)
      return res
        .status(404)
        .json({ success: false, message: "Post not found." });

    // Keep max 10 auto-saves per post — delete oldest if over
    const count = await PostRevision.countDocuments({
      post: post._id,
      note: "Auto-save",
    });
    if (count >= 10) {
      const oldest = await PostRevision.findOne({
        post: post._id,
        note: "Auto-save",
      }).sort({ createdAt: 1 });
      if (oldest) await oldest.deleteOne();
    }

    const revision = await PostRevision.create({
      post: post._id,
      content: content || post.content,
      title: title || post.title,
      savedBy: req.user.id,
      version: count + 1,
      note: "Auto-save",
    });

    res.json({ success: true, data: revision });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
