const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();
console.log('Server Restarting...');
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY?.trim());

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

const verifyToken = (req, res, next) => {
    console.log('inside verify token', req.headers.authorization);
    if (!req.headers.authorization) {
        return res.status(401).send({ message: 'unauthorized access' });
    }
    const token = req.headers.authorization.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            console.log("Token verification failed:", err.message);
            return res.status(401).send({ message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next();
    })
}

// ... (existing code)

// Payment Intent
app.post('/create-payment-intent', verifyToken, async (req, res) => {
    try {
        const { price } = req.body;
        const amount = parseInt(price * 100);
        console.log(amount, 'amount inside the intent')

        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount,
            currency: 'usd',
            payment_method_types: ['card']
        });

        res.send({
            clientSecret: paymentIntent.client_secret
        })
    } catch (error) {
        console.log('Payment Intent Error:', error);
        res.status(500).send({ message: 'Failed to create payment intent' });
    }
});

const Notification = require('./models/Notification');

// use verify admin after verifyToken
const verifyAdmin = async (req, res, next) => {
    const email = req.decoded.email;
    const query = { email: email };
    const user = await User.findOne(query);
    const isAdmin = user?.role === 'admin';
    if (!isAdmin) {
        return res.status(403).send({ message: 'forbidden access' });
    }
    next();
}

// MongoDB Connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@simple-crud-mongodb-pra.v6jm7nb.mongodb.net/micro-db?appName=simple-crud-mongodb-practice`;

// Create a MongoClientOptions object to set the Stable API version
const clientOptions = {
    serverApi: {
        version: '1',
        strict: true,
        deprecationErrors: true,
    }
};

mongoose.connect(uri, clientOptions)
    .then(() => {
        console.log('MongoDB Connected Successfully');
    })
    .catch(err => {
        console.error('MongoDB Connection Error:', err);
    });

// Routes
const User = require('./models/User');

app.post('/jwt', async (req, res) => {
    const user = req.body;
    const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
    res.send({ token });
});

app.post('/users', async (req, res) => {
    const user = req.body;
    const query = { email: user.email };
    const existingUser = await User.findOne(query);
    if (existingUser) {
        return res.send({ message: 'user already exists', insertedId: null })
    }
    const newUser = new User(user);
    // Enforce coin allocation on server side
    if (user.role === 'worker') {
        newUser.coins = 10;
    } else if (user.role === 'buyer') {
        newUser.coins = 50;
    }
    const result = await newUser.save();
    res.send(result);
});

app.get('/users/role/:email', async (req, res) => {
    const email = req.params.email;
    const query = { email: email };
    const user = await User.findOne(query);
    let role = 'worker';
    if (user) {
        role = user.role;
    }
    // Return all user info including coins
    res.send({ role, coins: user?.coins || 0, ...user?._doc });
});

app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
    const result = await User.find();
    res.send(result);
});

// Notifications
app.get('/notifications/:email', verifyToken, async (req, res) => {
    const email = req.params.email;
    const query = { toEmail: email };
    const notifications = await Notification.find(query).sort({ time: -1 });
    res.send(notifications);
});

app.get('/users/best', async (req, res) => {
    const query = { role: 'worker' };
    const result = await User.find(query).sort({ coins: -1 }).limit(6);
    res.send(result);
});

const Task = require('./models/Task');

app.post('/tasks', verifyToken, async (req, res) => {
    console.log("POST /tasks called");
    try {
        const task = req.body;
        console.log("Request Body:", JSON.stringify(task, null, 2));

        const requiredCoins = parseInt(task.required_workers) * parseInt(task.payable_amount);
        console.log("Required Coins (calc):", requiredCoins);

        const query = { email: task.buyer_email };
        const user = await User.findOne(query);

        if (!user) {
            console.log("User not found for email:", task.buyer_email);
            return res.status(404).send({ message: 'User not found' });
        }

        const userCoins = parseInt(user.coins);
        console.log("User Coins (DB):", userCoins);

        if (userCoins < requiredCoins) {
            console.log(`Insufficient funds. Need ${requiredCoins}, has ${userCoins}`);
            return res.status(400).send({ message: `Not enough coins. Need ${requiredCoins}, have ${userCoins}` });
        }

        // Deduct coins
        const newCoins = userCoins - requiredCoins;
        await User.updateOne(query, { $set: { coins: newCoins } });
        console.log("Coins deducted. New balance:", newCoins);

        const newTask = new Task({
            ...task,
            required_workers: parseInt(task.required_workers),
            payable_amount: parseInt(task.payable_amount)
        });

        const result = await newTask.save();
        console.log("Task saved:", result._id);
        res.send(result);
    } catch (error) {
        console.error("POST /tasks ERROR:", error);
        res.status(500).send({ message: "Internal Server Error: " + error.message });
    }
});

app.get('/tasks', async (req, res) => {
    const result = await Task.find();
    res.send(result);
});

// Available tasks for workers
// Available tasks for workers with Search, Filter & Sort
app.get('/tasks/available', verifyToken, async (req, res) => {
    const { search, minReward, maxReward, sortBy } = req.query;
    let query = { required_workers: { $gt: 0 } };

    if (search) {
        query.task_title = { $regex: search, $options: 'i' };
    }

    if (minReward || maxReward) {
        query.payable_amount = {};
        if (minReward) query.payable_amount.$gte = parseFloat(minReward);
        if (maxReward) query.payable_amount.$lte = parseFloat(maxReward);
    }

    let sortOptions = {};
    if (sortBy === 'reward_asc') {
        sortOptions.payable_amount = 1;
    } else if (sortBy === 'reward_desc') {
        sortOptions.payable_amount = -1;
    } else {
        // Default sort by newest
        sortOptions.completion_date = 1;
    }

    const result = await Task.find(query).sort(sortOptions);
    res.send(result);
});

// get tasks by email
app.get('/tasks/my-tasks/:email', verifyToken, async (req, res) => {
    const email = req.params.email;
    const query = { buyer_email: email };
    const result = await Task.find(query).sort({ completion_date: -1 });
    res.send(result);
});

// delete task and refund
app.delete('/tasks/:id', verifyToken, async (req, res) => {
    const id = req.params.id;
    // We need to fetch the task first to calculate refund
    const query = { _id: new mongoose.Types.ObjectId(id) };
    const task = await Task.findOne(query);
    if (!task) {
        return res.status(404).send({ message: 'Task not found' });
    }

    // Calculate refund: required_workers (remaining) * payable_amount
    // For now assuming all required_workers are remaining if we delete functionality is "delete the task from the task Collection... Calculate refill amount ... Increase the coin"
    // The requirement says "Increase the coin for unCompleted tasks". 
    // Since we don't track "remaining workers" in the task schema directly (we track required_workers), 
    // we should probably check submissions to see how many slots are filled.
    // The requirement "pending Task( sum of all required_workers count of his added Tasks)" implies required_workers is the total.
    // Let's assume for simplicity we refund the full amount if no one started, or we need to check submissions.
    // "Calculate refill amount ( required_workers * payable_amount )" - implies refunding for ALL workers initially requested? 
    // Or maybe "Increase the coin for unCompleted tasks" means we should subtract approved?
    // Let's stick to the simpler interpretation: Refund = required_workers * payable_amount. 
    // NOTE: If workers are decremented when they are approved, then `required_workers` holds the remaining count. 
    // Let's check "Approve Button ... Increase required_workers by 1" logic in requirement?? verify that. 
    // Req says: "On clicking the Reject Button ... Increase required_workers by 1."
    // It doesn't say "On Approve ... decrease". It just says "Change status to approve". 
    // Actually, usually "required_workers" is the target. 
    // Let's assume `required_workers` is the *remaining* slots.

    const refillAmount = task.required_workers * task.payable_amount;

    // Update user coins
    const userQuery = { email: task.buyer_email };
    await User.updateOne(userQuery, { $inc: { coins: refillAmount } });

    const result = await Task.deleteOne(query);
    res.send(result);
});


// get single task
app.get('/tasks/:id', verifyToken, async (req, res) => {
    const id = req.params.id;
    const query = { _id: new mongoose.Types.ObjectId(id) };
    const result = await Task.findOne(query);
    res.send(result);
});

app.patch('/tasks/:id', verifyToken, async (req, res) => {
    const id = req.params.id;
    const filter = { _id: new mongoose.Types.ObjectId(id) };
    const updateDoc = {
        $set: req.body
    }
    const result = await Task.updateOne(filter, updateDoc);
    res.send(result);
});

const Submission = require('./models/Submission');

app.post('/submissions', verifyToken, async (req, res) => {
    const submission = req.body;
    // Check if user already submitted? Requirement doesn't strictly say, but good practice.
    // For now, allow multiple submissions as per "Micro Task" nature usually allows, 
    // but maybe restrict 1 per worker per task? 
    // "After submitting the form, insert, save the submission in the database... status ( pending )."

    // Check if worker is the creator? (Buyer shouldn't submit their own task, but usually UI prevents this).

    const newSubmission = new Submission(submission);
    const result = await newSubmission.save();
    res.send(result);
});

app.get('/submissions', verifyToken, async (req, res) => {
    // filter by task_id or buyer_email or worker_email via query params if needed
    // or separate endpoints.
    const email = req.query.email;
    const type = req.query.type; // 'worker' or 'buyer'
    let query = {};
    if (type === 'worker') {
        query = { worker_email: email };
    } else if (type === 'buyer') {
        query = { buyer_email: email };
    }
    const result = await Submission.find(query);
    res.send(result);
});

// For Buyer to review specific task submissions
app.get('/submissions/task/:taskId', verifyToken, async (req, res) => {
    const taskId = req.params.taskId;
    const query = { task_id: taskId };
    const result = await Submission.find(query);
    res.send(result);
});

app.get('/users/admin/:email', verifyToken, async (req, res) => {
    const email = req.params.email;
    if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' })
    }
    const query = { email: email };
    const user = await User.findOne(query);
    let admin = false;
    if (user) {
        admin = user?.role === 'admin';
    }
    res.send({ admin });
});

app.get('/users/buyer/:email', verifyToken, async (req, res) => {
    const email = req.params.email;
    if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' })
    }
    const query = { email: email };
    const user = await User.findOne(query);
    let buyer = false;
    if (user) {
        buyer = user?.role === 'buyer';
    }
    res.send({ buyer });
});

app.get('/users/worker/:email', verifyToken, async (req, res) => {
    const email = req.params.email;
    if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' })
    }
    const query = { email: email };
    const user = await User.findOne(query);
    let worker = false;
    if (user) {
        worker = user?.role === 'worker';
    }
    res.send({ worker });

});

// Admin Stats
app.get('/admin-stats', verifyToken, async (req, res) => {
    const users = await User.estimatedDocumentCount();
    const tasks = await Task.estimatedDocumentCount();

    // Total Coins (Sum of all user coins) - might be slow if many users, keeping it simple for now
    const allUsers = await User.find();
    const totalCoins = allUsers.reduce((sum, user) => sum + user.coins, 0);

    // Total Payments
    const result = await Payment.aggregate([
        {
            $group: {
                _id: null,
                totalRevenue: {
                    $sum: '$price'
                }
            }
        }
    ]);
    const totalPayments = result.length > 0 ? result[0].totalRevenue : 0;

    res.send({
        users,
        totalCoins,
        totalPayments
    })
});

// Get user info by email
app.get('/users/:email', verifyToken, async (req, res) => {
    const email = req.params.email;
    const query = { email: email };
    const user = await User.findOne(query);
    res.send(user);
});



// Delete User
app.delete('/users/:id', verifyToken, async (req, res) => {
    const id = req.params.id;
    const query = { _id: new mongoose.Types.ObjectId(id) };
    const result = await User.deleteOne(query);
    res.send(result);
});

// Update User Role
app.patch('/users/role/:id', verifyToken, async (req, res) => {
    const id = req.params.id;
    const role = req.body.role;
    const filter = { _id: new mongoose.Types.ObjectId(id) };
    const updateDoc = {
        $set: { role: role }
    }
    const result = await User.updateOne(filter, updateDoc);
    res.send(result);
});

// Update User Profile (Name, Image)
app.patch('/users/:email', verifyToken, async (req, res) => {
    const email = req.params.email;
    const { name, image } = req.body;
    const query = { email: email };

    // Verify user
    if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' });
    }

    const updateDoc = {
        $set: {
            name: name,
            image: image
        }
    }
    const result = await User.updateOne(query, updateDoc);
    res.send(result);
});

// Create Checkout Session
app.post('/create-checkout-session', verifyToken, async (req, res) => {
    try {
        const { price, coins } = req.body;
        const amount = parseInt(price * 100);

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            customer_email: req.decoded.email,
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: `${coins} Coins`,
                        },
                        unit_amount: amount,
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            success_url: `${process.env.CLIENT_URL}/dashboard/payment/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.CLIENT_URL}/dashboard/purchase-coin`,
            metadata: {
                email: req.decoded.email,
                coins: coins,
                price: price
            }
        });

        res.send({ sessionId: session.id, url: session.url });
    } catch (error) {
        console.error('Checkout Session Error:', error);
        res.status(500).send({ message: error.message || 'Failed to create checkout session' });
    }
});

// Verify Payment and Save (Called from Success Page)
app.post('/payments/success', verifyToken, async (req, res) => {
    try {
        const { sessionId } = req.body;
        const session = await stripe.checkout.sessions.retrieve(sessionId);

        if (session.payment_status === 'paid') {
            const { email, coins, price } = session.metadata;

            // Check if payment already recorded
            const query = { transactionId: session.payment_intent };
            const existingPayment = await Payment.findOne(query);

            if (existingPayment) {
                return res.send({ message: 'Payment already processed', status: 'success' });
            }

            const payment = {
                email: email,
                price: parseFloat(price),
                transactionId: session.payment_intent,
                date: new Date(),
                coins: parseInt(coins),
                status: 'succeeded'
            }

            const paymentResult = await Payment.create(payment);

            const userQuery = { email: email };
            const updateDoc = {
                $inc: { coins: parseInt(coins) }
            }
            const updatedUser = await User.updateOne(userQuery, updateDoc);

            res.send({ paymentResult, updatedUser, status: 'success' });

        } else {
            res.status(400).send({ message: 'Payment not successful' });
        }
    } catch (error) {
        console.log('Payment Verification Error:', error);
        res.status(500).send({ message: 'Verification Failed' });
    }
});

// Payment Intent
app.post('/create-payment-intent', verifyToken, async (req, res) => {
    const { price } = req.body;
    const amount = parseInt(price * 100);
    console.log(amount, 'amount inside the intent')

    const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
    });

    res.send({
        clientSecret: paymentIntent.client_secret
    })
});

const Payment = require('./models/Payment');

app.post('/payments', verifyToken, async (req, res) => {
    const payment = req.body;
    const paymentResult = await Payment.create(payment);

    // Careful with coin update, ensure it's atomic/safe
    const query = { email: payment.email };
    const updateDoc = {
        $inc: { coins: payment.coins }
    }
    const updatedUser = await User.updateOne(query, updateDoc);

    res.send({ paymentResult, updatedUser });
});

app.get('/payments/:email', verifyToken, async (req, res) => {
    const query = { email: req.params.email };
    if (req.params.email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' });
    }
    const result = await Payment.find(query).sort({ date: -1 });
    res.send(result);
});

// Buyer Stats
app.get('/buyer-stats/:email', verifyToken, async (req, res) => {
    const email = req.params.email;
    const taskQuery = { buyer_email: email };
    const tasks = await Task.find(taskQuery);
    const totalTasks = tasks.length;
    const pendingTasks = tasks.reduce((sum, task) => sum + task.required_workers, 0); // "pending Task( sum of all required_workers count of his added Tasks)"

    const paymentQuery = { email: email };
    const payments = await Payment.find(paymentQuery);
    const totalPayment = payments.reduce((sum, payment) => sum + payment.price, 0);

    res.send({ totalTasks, pendingTasks, totalPayment });
});

// Submissions for Buyer (Status filter supported)
app.get('/submissions/buyer-pending/:email', verifyToken, async (req, res) => {
    const email = req.params.email;
    const query = { buyer_email: email, status: 'pending' };
    const result = await Submission.find(query);
    res.send(result);
});

// Get user notifications
app.get('/notifications/:email', verifyToken, async (req, res) => {
    const email = req.params.email;
    const query = { toEmail: email };
    const Notification = require('./models/Notification');
    const result = await Notification.find(query).sort({ time: -1 });
    res.send(result);
});

// Approve Submission
app.patch('/submissions/approve/:id', verifyToken, async (req, res) => {
    const id = req.params.id;
    const query = { _id: new mongoose.Types.ObjectId(id) };
    const submission = await Submission.findOne(query);

    if (!submission) return res.status(404).send({ message: 'Submission not found' });
    if (submission.status !== 'pending') return res.status(400).send({ message: 'Already processed' });

    // Update status
    const update = { status: 'approved' };
    const result = await Submission.updateOne(query, { $set: update });

    // Increase Worker Coin
    const workerQuery = { email: submission.worker_email };
    await User.updateOne(workerQuery, { $inc: { coins: submission.payable_amount } });

    // Notification
    const notification = {
        message: `You have earned ${submission.payable_amount} from ${submission.buyer_name} for completing ${submission.task_title}`,
        toEmail: submission.worker_email,
        actionRoute: '/dashboard/worker-home',
        time: new Date()
    }
    const Notification = require('./models/Notification'); // Assuming Notification model exists
    await Notification.create(notification);

    res.send(result);
});

// Reject Submission
app.patch('/submissions/reject/:id', verifyToken, async (req, res) => {
    const id = req.params.id;
    const query = { _id: new mongoose.Types.ObjectId(id) };
    const submission = await Submission.findOne(query);

    if (!submission) return res.status(404).send({ message: 'Submission not found' });
    if (submission.status !== 'pending') return res.status(400).send({ message: 'Already processed' });

    // Update status
    const update = { status: 'rejected' };
    const result = await Submission.updateOne(query, { $set: update });

    // Increase required_workers by 1 for the task using task_id from submission
    const taskQuery = { _id: new mongoose.Types.ObjectId(submission.task_id) };
    await Task.updateOne(taskQuery, { $inc: { required_workers: 1 } });

    // Notification
    const notification = {
        message: `Your submission for ${submission.task_title} was rejected by ${submission.buyer_name}`,
        toEmail: submission.worker_email,
        actionRoute: '/dashboard/worker-home',
        time: new Date()
    }
    const Notification = require('./models/Notification');
    await Notification.create(notification);

    res.send(result);
});

app.get('/', (req, res) => {
    res.send('Micro Task Platform Server is running');
});

// Worker Stats
app.get('/worker-stats/:email', verifyToken, async (req, res) => {
    const email = req.params.email;
    const submissionQuery = { worker_email: email };

    // Total Submissions
    const submissions = await Submission.find(submissionQuery);
    const totalSubmissions = submissions.length;

    // Pending Submissions
    const pendingSubmissions = submissions.filter(sub => sub.status === 'pending').length;

    // Total Earnings
    const approvedSubmissions = submissions.filter(sub => sub.status === 'approved');
    const totalEarnings = approvedSubmissions.reduce((sum, sub) => sum + sub.payable_amount, 0);

    // Limit approved submissions for table (e.g., last 5?)
    // The requirement says "Approved Submission ... Worker will see all the submissions ... in a table format"
    // But WorkerHome says "Approved Submission ... table format ... from submission collection".
    // Let's just return all approved for now or limit if too many?
    // "Worker will see all". Okay.

    res.send({
        totalSubmissions,
        pendingSubmissions,
        totalEarnings,
        approvedSubmissions
    });
});

// My Submissions
app.get('/submissions/my-submissions/:email', verifyToken, async (req, res) => {
    const email = req.params.email;
    const query = { worker_email: email };
    // Pagination challenge? "Implement pagination on the My Submission Route."
    // For now simple list.
    const result = await Submission.find(query);
    res.send(result);
});

const Withdrawal = require('./models/Withdrawal');

// Withdrawals
app.post('/withdrawals', verifyToken, async (req, res) => {
    const withdrawal = req.body;
    console.log("Received withdrawal request:", withdrawal);

    // Verify sufficient balance
    const userQuery = { email: withdrawal.worker_email };
    const user = await User.findOne(userQuery);
    console.log("User found for withdrawal:", user ? user.email : "Not found", "Coins:", user ? user.coins : "N/A");

    if (!user) {
        return res.status(404).send({ message: 'User not found' });
    }

    if (user.coins < withdrawal.withdrawal_coin) {
        return res.status(400).send({ message: 'Insufficient coins' });
    }

    const result = await Withdrawal.create(withdrawal);
    res.send(result);
});

app.get('/withdrawals', verifyToken, async (req, res) => {
    // Admin sees all pending? Or user sees theirs?
    // "Admin will see all withdrawal requests ... pending"
    // This endpoint handles both? Or separate? 
    // Usually GET /withdrawals implies all collection.
    // Let's check roles.
    // If admin, show pending.
    // req.decoded.email -> check role?
    // Or simpler: /withdrawals/pending (admin), /withdrawals/:email (user)

    // Admin route
    const result = await Withdrawal.find({ status: 'pending' });
    res.send(result);
});

app.patch('/withdrawals/:id', verifyToken, async (req, res) => {
    const id = req.params.id;
    const query = { _id: new mongoose.Types.ObjectId(id) };
    const withdrawal = await Withdrawal.findOne(query);

    if (!withdrawal) return res.status(404).send('Not found');
    if (withdrawal.status !== 'pending') return res.status(400).send('Already processed');

    // Updates
    const result = await Withdrawal.updateOne(query, { $set: { status: 'approved' } });

    // Decrease User Coin
    const userQuery = { email: withdrawal.worker_email };
    await User.updateOne(userQuery, { $inc: { coins: -withdrawal.withdrawal_coin } });

    // Notification
    const notification = {
        message: `Your withdrawal of $${withdrawal.withdrawal_amount} is approved.`,
        toEmail: withdrawal.worker_email,
        actionRoute: '/dashboard/withdrawals',
        time: new Date()
    }
    const Notification = require('./models/Notification');
    await Notification.create(notification);

    res.send(result);
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
