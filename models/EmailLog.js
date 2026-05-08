const mongoose = require("mongoose");

const EmailLogSchema = new mongoose.Schema(
  {
    subject: { type: String, required: true },
    sentTo: { type: Number, default: 0 },
    sentAt: { type: Date, default: Date.now },
    strategy: { type: String, default: "manual" },
    opens: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    unsubscribes: { type: Number, default: 0 },
    bounces: { type: Number, default: 0 },
    // Per-email tracking
    trackingId: { type: String, unique: true },
    html: { type: String, default: "" },
  },
  { timestamps: true },
);

// Computed rates
EmailLogSchema.virtual("openRate").get(function () {
  if (!this.sentTo) return 0;
  return Math.round((this.opens / this.sentTo) * 100);
});

EmailLogSchema.virtual("clickRate").get(function () {
  if (!this.sentTo) return 0;
  return Math.round((this.clicks / this.sentTo) * 100);
});

EmailLogSchema.virtual("unsubscribeRate").get(function () {
  if (!this.sentTo) return 0;
  return parseFloat(((this.unsubscribes / this.sentTo) * 100).toFixed(2));
});

EmailLogSchema.set("toJSON", { virtuals: true });
EmailLogSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("EmailLog", EmailLogSchema);
