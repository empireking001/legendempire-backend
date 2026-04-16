const { User, Category } = require('../models');

module.exports = async function seed() {
  try {
    // Create admin if none exists
    if (!(await User.findOne({ role: 'admin' }))) {
      await User.create({
        name:     'Admin',
        email:    process.env.ADMIN_EMAIL    || 'admin@legendempire.com',
        password: process.env.ADMIN_PASSWORD || 'Admin@LegendEmpire2025',
        role:     'admin',
        bio:      'Publisher at LegendEmpire',
      });
      console.log('✅ Admin account created →', process.env.ADMIN_EMAIL);
    }

    // Create default categories if none exist
    if ((await Category.countDocuments()) === 0) {
      const cats = [
        { name: 'Scholarships', slug: 'scholarships', description: 'Fully funded & partial scholarships worldwide',   color: '#6366f1', icon: '🎓', order: 1 },
        { name: 'Jobs',         slug: 'jobs',         description: 'Remote jobs and career opportunities',            color: '#10b981', icon: '💼', order: 2 },
        { name: 'Technology',   slug: 'technology',   description: 'Tech news, tools, and tutorials',                color: '#f59e0b', icon: '💻', order: 3 },
        { name: 'Money',        slug: 'money',        description: 'Finance, investing, and wealth tips',            color: '#ef4444', icon: '💰', order: 4 },
        { name: 'Education',    slug: 'education',    description: 'Learning resources and academic guides',         color: '#8b5cf6', icon: '📚', order: 5 },
        { name: 'News',         slug: 'news',         description: 'Latest news and current events',                color: '#ec4899', icon: '📰', order: 6 },
      ];
      await Category.insertMany(cats);
      console.log('✅ Default categories created');
    }
  } catch (err) {
    console.warn('⚠ Seed warning:', err.message);
  }
};
