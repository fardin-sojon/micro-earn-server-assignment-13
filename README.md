# 🌟 Micro Earn – Backend API

## 🎯 Project Purpose
This is the backend server for the **Micro Earn** platform. It provides a robust RESTful API to handle user authentication, task management, payment processing, and administrative functions. It serves as the bridge between the React frontend and the MongoDB database.

---

### 🔗 [🌐 Live API URL](https://micro-earn-assignment-13.netlify.app/)

## � Key Features

✅ **Secure API Endpoints**
- JWT (JSON Web Token) authentication for protected routes.
- Middleware to verify Admin, Buyer, and Worker roles.

✅ **User Management**
- create and update user profiles.
- Role-based retrieval of user data (e.g., fetching top workers).

✅ **Task Management**
- **CRUD Operations:** Create, Read, Update, and Delete tasks.
- Optimized queries for fetching tasks with pagination (future scope).

✅ **Submission Handling**
- Endpoints for workers to submit proof.
- Endpoints for buyers to approve or reject submissions and update balances.

✅ **Financial Transactions**
- **Stripe Integration:** Create payment intents for coin purchases.
- **Withdrawal Requests:** APIs to handle and approve withdrawal requests.
- **Coin Logic:** Atomic updates to user coin balances (increment/decrement) ensuring data integrity.

---

## 📦 NPM Packages Used

| Package | Purpose |
|---------|---------|
| express | Web framework for Node.js |
| cors | Cross-Origin Resource Sharing |
| dotenv | Environment variable management |
| jsonwebtoken | User authentication & secure tokens |
| mongodb | Official MongoDB driver |
| stripe | Payment processing integration |
| nodemon | Development monitoring (dev dependency) |

---

## 🧩 Tools & Technologies
- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MongoDB (Atlas)
- **Authentication:** JWT (JSON Web Tokens)
- **Payment Gateway:** Stripe
- **Deployment:** Vercel

---

## ⚙️ Run Locally

### Prerequisites
- Node.js installed
- MongoDB Atlas account (or local MongoDB)
- Stripe Secret Key

### Installation Steps

```bash
# 1. Clone the repository
git clone <https://github.com/fardin-sojon/micro-earn-server-assignment-13.git>

# 2. Install dependencies
npm install

# 3. Configure Environment Variables
# Create a .env file in the server directory with:

DB_USER=your_mongodb_username
DB_PASS=your_mongodb_password
ACCESS_TOKEN_SECRET=your_jwt_secret_token
STRIPE_SECRET_KEY=your_stripe_secret_key

# 4. Run the server
# For development (with nodemon):
nodemon index.js

# For production:
node index.js
```

The server will start on `http://localhost:5000` by default.

---

## 🔗 API Endpoints Overview

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/jwt` | Generate access token | Public |
| POST | `/users` | Create or update user | Public |
| GET | `/users` | Get all users | Admin |
| GET | `/tasks` | Get all available tasks | Public/Worker |
| POST | `/tasks` | Create a new task | Buyer |
| GET | `/my-tasks/:email` | Get buyer specific tasks | Buyer |
| DELETE | `/tasks/:id` | Delete a task | Buyer/Admin |
| POST | `/submissions` | Submit work proof | Worker |
| GET | `/submissions/:email` | Get worker submissions | Worker |
| PATCH | `/submission/:id` | Approve/Reject submission | Buyer |
| POST | `/create-payment-intent` | Initialize Stripe payment | Buyer |
| POST | `/withdrawals` | Request withdrawal | Worker |

---

## 👨‍💻 Developer
**Fardin Sojon**
- Email: fardinsojon@gmail.com
- GitHub: [@fardin-sojon](https://github.com/fardin-sojon)

---
Made with ❤️ by Fardin Rahman Sojon
