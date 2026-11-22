# Haat: E-Commerce and Inventory Management System

A full-stack marketplace where customers shop, sellers manage their products and orders, and admins oversee everything. Built with React, Node.js, Express, MongoDB and Socket.IO.

Payments are simulated. No real card or bank data is used.

## Features

- Customer, seller and admin roles with secure login (JWT and bcrypt)
- Product search, filters, sorting and pagination
- Shopping cart with server-side price calculation
- Orders with a fixed status flow: pending, confirmed, shipped, delivered, cancelled
- Stock updates that prevent overselling, and stock restored on cancellation
- Sales and inventory reports for sellers and admins
- Real-time order and low-stock notifications

## Tech Stack

React, Vite, Node.js, Express, MongoDB (Mongoose), Socket.IO

## Setup

1. Install Node.js 18 or newer and get a MongoDB database (for example a free MongoDB Atlas cluster).

2. Install dependencies:
   ```
   npm run install:all
   ```

3. Create a `.env` file in the project root:
   ```
   PORT=5000
   MONGO_URI=your_mongodb_connection_string
   JWT_ACCESS_SECRET=any_long_random_text
   JWT_REFRESH_SECRET=another_long_random_text
   ADMIN_EMAIL=admin@shop.local
   ADMIN_PASSWORD=your_admin_password
   ```

4. Add demo data:
   ```
   npm run seed
   ```

5. Start the project:
   ```
   npm run dev:all
   ```
   Open http://localhost:5173

## Demo Accounts

| Role | Email | Password |
|---|---|---|
| Admin | admin@shop.local | the `ADMIN_PASSWORD` you set |
| Seller | seller@shop.local | Seller@12345 |
| Customer | register on the website | |

## Author

**Dev Yadav**
B.Tech CSE (AI & ML), Section D
