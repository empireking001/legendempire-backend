const mongoose = require("mongoose");

const AnswerSchema = new mongoose.Schema(
  {
    content: { type: String, required: true },
    author: { type: String, default: "Anonymous" },
    email: { type: String, default: "" },
    isAdmin: { type: Boolean, default: false },
    upvotes: { type: Number, default: 0 },
    upvotedBy: [{ type: String }], // IP addresses
    isAccepted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const ForumQuestionSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true, trim: true },
    author: { type: String, default: "Anonymous" },
    email: { type: String, default: "" },
    category: {
      type: String,
      enum: [
        "scholarships",
        "remote-jobs",
        "visa",
        "technology",
        "finance",
        "education",
        "general",
      ],
      default: "general",
    },
    tags: [{ type: String }],
    views: { type: Number, default: 0 },
    upvotes: { type: Number, default: 0 },
    upvotedBy: [{ type: String }],
    answers: [AnswerSchema],
    status: {
      type: String,
      enum: ["open", "answered", "closed"],
      default: "open",
    },
    isPinned: { type: Boolean, default: false },
    isApproved: { type: Boolean, default: true },
    slug: { type: String, unique: true, sparse: true },
  },
  { timestamps: true },
);

// Auto-generate slug
ForumQuestionSchema.pre("save", function (next) {
  if (!this.slug) {
    this.slug =
      this.title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .substring(0, 80) +
      "-" +
      Date.now().toString(36);
  }
  next();
});

module.exports = mongoose.model("ForumQuestion", ForumQuestionSchema);
