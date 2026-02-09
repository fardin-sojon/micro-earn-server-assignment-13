const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
    task_title: {
        type: String,
        required: true,
    },
    task_detail: {
        type: String,
        required: true,
    },
    required_workers: {
        type: Number,
        required: true,
    },
    payable_amount: {
        type: Number,
        required: true,
    },
    completion_date: {
        type: Date,
        required: true,
    },
    submission_info: {
        type: String,
        required: true,
    },
    task_image_url: {
        type: String,
        required: true,
    },
    buyer_email: {
        type: String,
        required: true,
    },
    buyer_name: {
        type: String,
        required: true,
    },
    created_at: {
        type: Date,
        default: Date.now,
    },
});

const Task = mongoose.model('Task', taskSchema);

module.exports = Task;
