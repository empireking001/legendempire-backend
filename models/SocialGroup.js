const mongoose = require("mongoose");

const SocialGroupSchema = new mongoose.Schema(
  {
    platform: {
      type: String,
      enum: [
        "whatsapp",
        "telegram",
        "facebook",
        "twitter",
        "instagram",
        "youtube",
        "tiktok",
      ],
      required: true,
    },
    label: { type: String, required: true, trim: true }, // e.g. "Scholarship Updates"
    url: { type: String, required: true, trim: true }, // the join link
    description: { type: String, default: "", trim: true }, // e.g. "Join 5,000+ members"
    memberCount: { type: String, default: "" }, // e.g. "5,000+"
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

module.exports = mongoose.model("SocialGroup", SocialGroupSchema);
