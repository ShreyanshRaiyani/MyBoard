require("dotenv").config();
const app = require('./app');
const connectDB = require('./Database/connect');

// Start Server
const PORT = process.env.PORT || 4000;

connectDB(process.env.MONGODB_URI);

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
})