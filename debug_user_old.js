const mongoose = require('mongoose');
require('dotenv').config({ path: './.env' });

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@simple-crud-mongodb-pra.v6jm7nb.mongodb.net/micro-db?appName=simple-crud-mongodb-practice`;

// Define Schema matching the one in User.js roughly, or just strict: false
const userSchema = new mongoose.Schema({}, { strict: false });
const User = mongoose.model('User', userSchema, 'users');

async function checkUser() {
    try {
        await mongoose.connect(uri);
        console.log("Connected to DB");

        const user = await User.findOne({ email: 'fardin@gmail.com' });
        console.log("User found:", user);

        if (user) {
            console.log("Coins type:", typeof user.coins);
            console.log("Coins value:", user.coins);
        }

    } catch (error) {
        console.error("Error:", error);
    } finally {
        await mongoose.disconnect();
    }
}

checkUser();
