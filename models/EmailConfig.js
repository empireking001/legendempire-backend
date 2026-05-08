const mongoose = require("mongoose");

const EmailConfigSchema = new mongoose.Schema(
  {
    // Only one config doc exists — singleton pattern
    singleton: { type: String, default: "config", unique: true },

    // SMTP settings
    smtpHost: { type: String, default: "" },
    smtpPort: { type: Number, default: 587 },
    smtpUser: { type: String, default: "" },
    smtpPass: { type: String, default: "" },
    smtpSecure: { type: Boolean, default: false },
    fromName: { type: String, default: "LegendEmpire" },
    fromEmail: { type: String, default: "" },
    replyTo: { type: String, default: "" },

    // Daily digest settings
    digestEnabled: { type: Boolean, default: false },
    digestTime: { type: String, default: "08:00" }, // HH:MM format
    digestLastSent: { type: Date, default: null },

    // Email strategy
    strategy: {
      type: String,
      enum: ["daily_digest", "weekly_digest", "instant", "manual"],
      default: "daily_digest",
    },
    strategyDesc: { type: String, default: "" },

    // Welcome email toggle
    sendWelcome: { type: Boolean, default: true },

    // Unsubscribe footer
    unsubscribeUrl: { type: String, default: "" },

    // Telegram settings
    telegramBotToken: { type: String, default: "" },
    telegramChatId: { type: String, default: "" },
    telegramEnabled: { type: Boolean, default: false },

    // Email tracking
    trackingEnabled: { type: Boolean, default: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("EmailConfig", EmailConfigSchema);
