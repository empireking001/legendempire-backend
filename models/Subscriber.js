const mongoose = require("mongoose");

const SubscriberSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    name: { type: String, default: "", trim: true },
    status: {
      type: String,
      enum: ["active", "unsubscribed"],
      default: "active",
    },
    confirmedAt: { type: Date, default: Date.now },
    source: { type: String, default: "website" }, // website, admin
    tags: [{ type: String }], // e.g. ['scholarships', 'jobs']
    opens: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    lastEmailAt: { type: Date, default: null },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Subscriber", SubscriberSchema);
