const { AffiliateLink } = require("../models");

exports.getAll = async (req, res) => {
  try {
    const links = await AffiliateLink.find().sort({ createdAt: -1 });
    res.json({ success: true, data: links });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { name, shortCode, destination, description } = req.body;
    if (!name || !shortCode || !destination)
      return res
        .status(400)
        .json({
          success: false,
          message: "Name, shortCode and destination required.",
        });
    const link = await AffiliateLink.create({
      name,
      shortCode: shortCode.toLowerCase().replace(/\s+/g, "-"),
      destination,
      description,
    });
    res
      .status(201)
      .json({ success: true, data: link, message: "Affiliate link created!" });
  } catch (err) {
    if (err.code === 11000)
      return res
        .status(400)
        .json({ success: false, message: "Short code already exists." });
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const link = await AffiliateLink.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true },
    );
    if (!link)
      return res.status(404).json({ success: false, message: "Not found." });
    res.json({ success: true, data: link, message: "Updated!" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.delete = async (req, res) => {
  try {
    await AffiliateLink.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Deleted." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Public redirect
exports.redirect = async (req, res) => {
  try {
    const link = await AffiliateLink.findOne({
      shortCode: req.params.code,
      isActive: true,
    });
    if (!link) return res.status(404).send("Link not found.");
    link.clicks += 1;
    await link.save();
    res.redirect(link.destination);
  } catch (err) {
    res.status(500).send("Error.");
  }
};
