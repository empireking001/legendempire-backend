const mongoose = require("mongoose");

const SchoolSchema = new mongoose.Schema(
  {
    // ── Core Identity ──────────────────────────────
    name: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, trim: true },
    shortName: { type: String, default: "", trim: true },
    acronym: { type: String, default: "", trim: true },

    // ── Classification ─────────────────────────────
    type: {
      type: String,
      enum: [
        "federal-university",
        "state-university",
        "private-university",
        "federal-polytechnic",
        "state-polytechnic",
        "private-polytechnic",
        "college-of-education",
        "monotechnic",
        "military-university",
      ],
      required: true,
    },
    ownership: {
      type: String,
      enum: ["federal", "state", "private"],
      required: true,
    },
    isAccredited: { type: Boolean, default: true },

    // ── Location ───────────────────────────────────
    state: {
      type: String,
      enum: [
        "Abia",
        "Adamawa",
        "Akwa Ibom",
        "Anambra",
        "Bauchi",
        "Bayelsa",
        "Benue",
        "Borno",
        "Cross River",
        "Delta",
        "Ebonyi",
        "Edo",
        "Ekiti",
        "Enugu",
        "FCT",
        "Gombe",
        "Imo",
        "Jigawa",
        "Kaduna",
        "Kano",
        "Katsina",
        "Kebbi",
        "Kogi",
        "Kwara",
        "Lagos",
        "Nasarawa",
        "Niger",
        "Ogun",
        "Ondo",
        "Osun",
        "Oyo",
        "Plateau",
        "Rivers",
        "Sokoto",
        "Taraba",
        "Yobe",
        "Zamfara",
      ],
      required: true,
    },
    city: { type: String, default: "", trim: true },
    address: { type: String, default: "", trim: true },

    // ── Media ──────────────────────────────────────
    logo: { type: String, default: "" },
    coverImage: { type: String, default: "" },
    logoPublicId: { type: String, default: "" },

    // ── About ──────────────────────────────────────
    established: { type: Number, default: null },
    description: { type: String, default: "" },
    motto: { type: String, default: "" },
    website: { type: String, default: "" },
    email: { type: String, default: "" },
    phone: { type: String, default: "" },
    faculties: [{ type: String }],
    studentCount: { type: String, default: "" },

    // ── Admission Info ─────────────────────────────
    jamb: {
      cutoffMark: { type: Number, default: null },
      subjectCombo: [{ type: String }],
    },
    postUtme: {
      hasExam: { type: Boolean, default: false },
      examFee: { type: String, default: "" },
      examFormat: { type: String, default: "" },
      examDate: { type: String, default: "" },
    },
    schoolFees: {
      freshmen: { type: String, default: "" },
      returning: { type: String, default: "" },
      lastUpdated: { type: Date, default: null },
    },
    applicationPortal: { type: String, default: "" },
    admissionRequirements: { type: String, default: "" },

    // ── Social ─────────────────────────────────────
    social: {
      facebook: { type: String, default: "" },
      twitter: { type: String, default: "" },
      instagram: { type: String, default: "" },
      youtube: { type: String, default: "" },
    },

    // ── SEO ────────────────────────────────────────
    metaTitle: { type: String, default: "" },
    metaDescription: { type: String, default: "" },

    // ── Status ─────────────────────────────────────
    isActive: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    views: { type: Number, default: 0 },
    tags: [{ type: String }],
  },
  { timestamps: true },
);

// ── Auto slug ─────────────────────────────────────
SchoolSchema.pre("save", function (next) {
  if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();
  }
  next();
});

// ── Virtual: type label ───────────────────────────
SchoolSchema.virtual("typeLabel").get(function () {
  const map = {
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
  return map[this.type] || this.type;
});

SchoolSchema.set("toJSON", { virtuals: true });
SchoolSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("School", SchoolSchema);
