const WorkRequest = require('../models/workerRequest');

// Generate Request Code
function generateRequestCandidate() {
    const numbers = '0123456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
        code += numbers.charAt(Math.floor(Math.random() * numbers.length));
    }
    return `RQ-${code}`;
}

module.exports = async function generateRequestes(req, res, next){
    try{
        let candidate;
        let exists = true;
        let attempts = 0;
        const maxAttempts = 100;

        // Keep generating until unique
        while (exists && attempts < maxAttempts) {
            candidate = generateRequestCandidate();
            exists = await WorkRequest.findOne({ requestNumber: candidate }).lean();
            attempts++;
            console.log(`Attempt ${attempts}: Generated ${candidate}, exists: ${!!exists}`);
        }

        if (attempts > maxAttempts) {
            console.error('Failed to generate unique Request number');
            // Fallback
            candidate = `RQ-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        }

        req.requestNumber = candidate;
        console.log(`Final request number: ${candidate}`);
        return next();

    } catch (err) {
        console.error('Error in generateRequest:', err);
        req.requestNumber = `RQ-${Date.now()}-ERR`;
        return next();
    }
}