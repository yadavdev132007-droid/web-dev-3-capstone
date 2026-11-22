const mongoose = require('mongoose');

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

const toObjectId = (id) => new mongoose.Types.ObjectId(id);

const parsePagination = (query) => {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 10, 1), 100);
  return { page, limit, skip: (page - 1) * limit };
};

const paginated = (data, total, { page, limit }) => ({
  data,
  pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 },
});

const generateOrderNumber = () =>
  `ORD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

const slugify = (s) =>
  s.toString().toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

module.exports = { round2, toObjectId, parsePagination, paginated, generateOrderNumber, slugify };
