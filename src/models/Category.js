const mongoose = require('mongoose');
const { slugify } = require('../utils/helpers');

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true, maxlength: 60 },
    slug: { type: String, unique: true, index: true },
    description: { type: String, trim: true, maxlength: 300 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

categorySchema.pre('validate', function (next) {
  if (this.isModified('name')) this.slug = slugify(this.name);
  next();
});

module.exports = mongoose.model('Category', categorySchema);
