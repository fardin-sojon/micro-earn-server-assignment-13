const mongoose = require('mongoose');

const withdrawalSchema = new mongoose.Schema({
    worker_email: {
        type: String,
        required: true,
    },
    worker_name: {
        type: String,
        required: true,
    },
    withdrawal_coin: {
        type: Number,
        required: true,
    },
    withdrawal_amount: {
        type: Number,
        required: true,
    },
    payment_system: {
        type: String,
        required: true,
    },
    account_number: {
        type: String,
        required: true,
    },
    withdraw_date: {
        type: Date,
        default: Date.now,
    },
    status: {
        type: String,
        enum: ['pending', 'approved'],
        default: 'pending',
    },
});

const Withdrawal = mongoose.model('Withdrawal', withdrawalSchema);

module.exports = Withdrawal;
