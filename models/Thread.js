// models/Thread.js (or ForumPost.js)
const mongoose = require("mongoose");

const threadSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    content: { type: String, required: true },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // 🔗 The Connection Link:
    school: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      default: null, // Optional, as some threads might be general discussions
    },

    category: { type: String, default: "general" }, // 'admission', 'jamb', 'campus-life'
  },
  { timestamps: true },
);

module.exports = mongoose.model("Thread", threadSchema);
