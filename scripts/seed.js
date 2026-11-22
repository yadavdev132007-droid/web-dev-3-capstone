// Usage: npm run seed   (creates admin, a seller, categories and sample products)
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const User = require('../src/models/User');
const Category = require('../src/models/Category');
const Product = require('../src/models/Product');

(async () => {
  await connectDB();

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@shop.local';
  let admin = await User.findOne({ email: adminEmail });
  if (!admin) {
    admin = await User.create({
      name: 'Platform Admin',
      email: adminEmail,
      password: process.env.ADMIN_PASSWORD || 'Admin@12345',
      role: 'admin',
    });
    console.log(`Admin created: ${adminEmail}`);
  } else console.log('Admin already exists');

  let seller = await User.findOne({ email: 'seller@shop.local' });
  if (!seller) {
    seller = await User.create({ name: 'Demo Seller', email: 'seller@shop.local', password: 'Seller@12345', role: 'seller' });
    console.log('Seller created: seller@shop.local / Seller@12345');
  }

  const names = ['Electronics', 'Books', 'Clothing', 'Home & Kitchen'];
  const cats = {};
  for (const n of names) {
    cats[n] = (await Category.findOne({ name: n })) || (await Category.create({ name: n }));
  }

  if ((await Product.countDocuments({ seller: seller._id })) === 0) {
    await Product.insertMany([
      { name: 'Wireless Mouse', description: '2.4GHz ergonomic mouse', price: 799, category: cats.Electronics._id, seller: seller._id, stock: 50 },
      { name: 'Mechanical Keyboard', description: 'Blue switch keyboard', price: 3499, category: cats.Electronics._id, seller: seller._id, stock: 20 },
      { name: 'Node.js in Practice', description: 'Programming book', price: 599, category: cats.Books._id, seller: seller._id, stock: 8, lowStockThreshold: 3 },
      { name: 'Cotton T-Shirt', description: '100% cotton', price: 499, category: cats.Clothing._id, seller: seller._id, stock: 100 },
      { name: 'Steel Water Bottle', description: '1L insulated bottle', price: 899, category: cats['Home & Kitchen']._id, seller: seller._id, stock: 5 },
    ]);
    console.log('Sample products created');
  }

  await mongoose.connection.close();
  console.log('Seed complete');
})().catch((e) => { console.error(e); process.exit(1); });
