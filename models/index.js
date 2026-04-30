// ── User Model ────────────────────────────────
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, minlength: 8, select: false },
    role: { type: String, enum: ["admin", "editor"], default: "admin" },
    permissions: {
      type: [String],
      default: ["posts", "categories", "comments", "subscribers"],
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    bio: { type: String, default: "" },
    avatar: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date, default: null },
  },
  { timestamps: true },
);

UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

UserSchema.methods.matchPassword = async function(entered) {
  return bcrypt.compare(entered, this.password);
};

const User = mongoose.model('User', UserSchema);

// ── Category Model ────────────────────────────
const CategorySchema = new mongoose.Schema({
  name:        { type: String, required: true, unique: true, trim: true },
  slug:        { type: String, required: true, unique: true, lowercase: true },
  description: { type: String, default: '' },
  color:       { type: String, default: '#6366f1' },
  icon:        { type: String, default: '📁' },
  isActive:    { type: Boolean, default: true },
  postCount:   { type: Number, default: 0 },
  order:       { type: Number, default: 0 },
}, { timestamps: true });

const Category = mongoose.model('Category', CategorySchema);

// ── Post Model ────────────────────────────────
const PostSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, lowercase: true },
    excerpt: { type: String, default: "" },
    content: { type: String, required: true },
    coverImage: { type: String, default: "" },
    coverImageId: { type: String, default: "" }, // Cloudinary public_id
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: { type: String, enum: ["draft", "published"], default: "draft" },
    tags: [{ type: String, lowercase: true, trim: true }],
    metaTitle: { type: String, default: "" },
    metaDesc: { type: String, default: "" },
    views: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    likedBy: [{ type: String }],
    commentsCount: { type: Number, default: 0 },
    isFeatured: { type: Boolean, default: false },
    // Scheduler
    scheduledAt: { type: Date, default: null },
    // Sponsored
    isSponsored: { type: Boolean, default: false },
    sponsoredLabel: { type: String, default: "Sponsored" },
    // SEO extras
    canonicalUrl: { type: String, default: "" },
    ogImage: { type: String, default: "" },
    // Analytics
    searchTerms: [{ type: String }],
    // Revision tracking
    currentVersion: { type: Number, default: 1 },
    readTime: { type: Number, default: 1 },
    publishedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// PostSchema.index({ slug: 1 });
PostSchema.index({ status: 1, publishedAt: -1 });
PostSchema.index({ category: 1, status: 1 });
PostSchema.index({ title: 'text', content: 'text', tags: 'text' });

PostSchema.pre('save', async function(next) {
  if (this.isModified('title') && !this.slug) {
    const slugify = require('slugify');
    let base = slugify(this.title, { lower: true, strict: true });
    let slug = base, n = 1;
    while (await mongoose.model('Post').findOne({ slug, _id: { $ne: this._id } }))
      slug = `${base}-${n++}`;
    this.slug = slug;
  }
  if (!this.excerpt && this.content)
    this.excerpt = this.content.replace(/<[^>]*>/g, '').substring(0, 160) + '...';
  if (this.isModified('content'))
    this.readTime = Math.max(1, Math.ceil(this.content.replace(/<[^>]*>/g, '').split(/\s+/).length / 200));
  if (this.isModified('status') && this.status === 'published' && !this.publishedAt)
    this.publishedAt = new Date();
  next();
});

const Post = mongoose.model('Post', PostSchema);

// ── Comment Model ─────────────────────────────
const CommentSchema = new mongoose.Schema({
  post:      { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
  name:      { type: String, required: true, trim: true },
  email:     { type: String, required: true, lowercase: true, trim: true },
  content:   { type: String, required: true, trim: true, maxlength: 1000 },
  status:    { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  parent:    { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', default: null },
  ipAddress: { type: String, default: '' },
}, { timestamps: true });

const Comment = mongoose.model('Comment', CommentSchema);

// ── PostRevision Model ─────────────────────────────
const PostRevisionSchema = new mongoose.Schema({
  post:      { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
  content:   { type: String, required: true },
  title:     { type: String, required: true },
  savedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  version:   { type: Number, default: 1 },
  note:      { type: String, default: 'Auto-save' },
}, { timestamps: true });

const PostRevision = mongoose.model('PostRevision', PostRevisionSchema);

// ── AffiliateLink Model ────────────────────────────
const AffiliateLinkSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true },
  shortCode:   { type: String, required: true, unique: true, trim: true },
  destination: { type: String, required: true, trim: true },
  clicks:      { type: Number, default: 0 },
  isActive:    { type: Boolean, default: true },
  description: { type: String, default: '' },
}, { timestamps: true });

const AffiliateLink = mongoose.model('AffiliateLink', AffiliateLinkSchema);

// ── SiteSettings Model (singleton) ────────────────
const SiteSettingsSchema = new mongoose.Schema({
  singleton:        { type: String, default: 'settings', unique: true },
  // AdSense
  adsenseEnabled:   { type: Boolean, default: false },
  adsenseId:        { type: String, default: '' },
  adSlotHeader:     { type: String, default: '' },
  adSlotSidebar:    { type: String, default: '' },
  adSlotInArticle:  { type: String, default: '' },
  adSlotFooter:     { type: String, default: '' },
  // SEO
  robotsTxt:        { type: String, default: 'User-agent: *\nAllow: /\nSitemap: /sitemap.xml' },
  googleVerification: { type: String, default: '' },
  defaultOgImage:   { type: String, default: '' },
  // Site
  maintenanceMode:  { type: Boolean, default: false },
}, { timestamps: true });

const SiteSettings = mongoose.model('SiteSettings', SiteSettingsSchema);

module.exports = {
  User,
  Category,
  Post,
  Comment,
  PostRevision,
  AffiliateLink,
  SiteSettings,
};
