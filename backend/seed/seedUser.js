const mongoose = require('mongoose');
require('dotenv').config();
const connectDB = require('../Database/connect');
const bcrypt = require('bcryptjs');

async function seedUser() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI is not set in environment');
  }

  await connectDB(mongoUri);

  const email = 'superadmin@gmail.com';
  const plainPassword = '123456'; // SuperAdmin password
  const collection = mongoose.connection.collection('users');

  console.log('Checking for existing user with email:', email);
  const userDoc = await collection.findOne({ email });
  
  if (userDoc) {
    console.log('Found existing user with _id:', userDoc._id.toString());
  }

  const hashedPassword = await bcrypt.hash(plainPassword, 10);
  const now = new Date();
  
  if (!userDoc) {
    // Create new user
    const insertDoc = {
      firstName: 'Super',
      lastName: 'Admin',
      email,
      password: hashedPassword,
      emailverified: true,
      userType: 'SuperAdmin',
      createdAt: now,
      updatedAt: now,
    };
    
    const result = await collection.insertOne(insertDoc);
    console.log('Insert result:', result);
    
    if (result && result.insertedId) {
      console.log('✅ Super user created:', email, 'id:', result.insertedId.toString());
    } else {
      console.warn('⚠️ Super user create may have failed (no insertedId)');
    }
  } else {
    // ALWAYS update password for existing user
    const updateFields = { 
      password: hashedPassword,  // Reset password to '123456'
      userType: 'SuperAdmin', 
      updatedAt: now,
      firstName: 'Super',  // Ensure first name is set
      lastName: 'Admin',   // Ensure last name is set
      emailverified: true  // Ensure email is verified
    };
    
    const updateResult = await collection.updateOne(
      { _id: userDoc._id }, 
      { $set: updateFields }
    );
    
    console.log('Update result:', updateResult);
    
    if (updateResult && updateResult.modifiedCount) {
      console.log('🔄 Updated SuperAdmin user with new password for user id:', userDoc._id.toString());
      console.log('🔑 Password has been reset to: 123456');
    } else if (updateResult && updateResult.matchedCount) {
      console.log('ℹ️ User already has SuperAdmin role with current password');
    } else {
      console.warn('⚠️ Update ran but did not match any document');
    }
  }
}

(async () => {
  try {
    await seedUser();
    await mongoose.connection.close();
    console.log('DB connection closed (success)');
    process.exit(0);
  } catch (err) {
    console.error('Seeding user failed:', err);
    try {
      await mongoose.connection.close();
      console.log('DB connection closed (after error)');
    } catch (e) {
      console.error('Error closing DB connection after failure:', e);
    }
    process.exit(1);
  }
})();