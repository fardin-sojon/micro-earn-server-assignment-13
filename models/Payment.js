const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    email: { type: String, required: true },
    price: { type: Number, required: true },
    transactionId: { type: String, required: true },
    date: { type: Date, default: Date.now },
    coins: { type: Number, required: true },
    status: { type: String, default: 'pending' }
});

const Payment = mongoose.model('Payment', paymentSchema);
module.exports = Payment;
