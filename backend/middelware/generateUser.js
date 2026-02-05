const User = require('../models/User');


// Generate User ID based on userType
function generateUserId(userType) {
    const prefixes = {
        HoardingOwner: 'HO',
        BannerUser: 'BO',
        Worker: 'WR'
    };

    const prefix = prefixes[userType];
    if (!prefix) throw new Error('Invalid userType');

    const numbers = '0123456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
        code += numbers.charAt(Math.floor(Math.random() * numbers.length));
    }
    return `${prefix}-${code}`;
}

module.exports = async function generateUser(req, res, next) {
    try {
        const { userType } = req.body;
        if (!userType) {
            return res.status(400).json({ error: 'userType is required' });
        }

        let candidate;
        let exists = true;
        let attempts = 0;
        const maxAttempts = 100;

        while (exists && attempts < maxAttempts) {
            const result = generateUserId(userType);
            candidate = result.id;
            prefix = result.prefix;
            exists = await User.findOne({ userId: candidate }).lean();
            attempts++;
        }

        if (attempts >= maxAttempts) {
            candidate = `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        }

        req.userId = candidate;
        return next();

    } catch (err) {
        console.error(`Error generating userId:`, err);
        req.userId = `${prefix}-ERR`;
        return next();
    }
}