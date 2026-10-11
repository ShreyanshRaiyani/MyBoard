const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const User = require('../models/User');

const protect = asyncHandler(async (req, res, next) => {
    let token;
    console.log("Fsdkfhsdkfjhsfkhj");
    console.log(req.headers.authorization);
    if (req.headers.authorization) {
        try {
            console.log('token found');

            if (req.headers.authorization.startsWith('Bearer ')) {
                token = req.headers.authorization.split(' ')[1];
            } else {
                token = req.headers.authorization;
            }

            // verify token  
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.id);

            if (!user) {
                return res.status(401).json({ error: 'User not found' });
            }

            req.userId = decoded.id;
            req.user = user;


            //   console.log(decoded);
            // console.log(req.user);
            next();
        } catch (error) {
            console.log(error);
            res.status(401).json({ error: 'Not authorized, token failed' });
        }
    }
    if (!token) {
        res.status(401).json({ error: 'Token is not found Please provide token' });
    }
});


const checkUserExists = async (req, res, next) => {
    const { email } = req.body;
    console.log(req.body);
    console.log("fdfksdgfjkdshf");

    // if (!username || !email) {
    //     return res.status(400).send('All fields are required');
    // }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
        return res.status(400).send('User already exists');
    }

    next();
};

module.exports = { protect, checkUserExists };