const mongoose = require('mongoose');
require('dotenv').config();
const connectDB = require('../Database/connect');

// register models used
require('../models/Plan');

async function seedPlan() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI is not set in environment');
  }

  await connectDB(mongoUri);

  const Plan = mongoose.model('Plan');
  const collection = mongoose.connection.collection('plans');

  console.log('Looking for existing plans...');
  
  // Define the three plans - applicable to HoardingOwner and BannerUser only (not Worker)
  const plansToCreate = [
    {
      name: 'Plan A',
      notes: 'Basic plan for HoardingOwners & BannerUsers - 1 month duration',
      currency: 'INR',
      price: 0,
      userCount: 5,
      gstPercentage: 0,
      discount: 0,
      duration: 30, // 1 month in days
      default: true,
      applicableUserTypes: ['HoardingOwner', 'BannerUser'], // Both user types can use
    },
    {
      name: 'Plan B',
      notes: 'Standard plan for HoardingOwners & BannerUsers - 3 months duration',
      currency: 'INR',
      price: 99,
      userCount: 10,
      gstPercentage: 18,
      discount: 10,
      duration: 90, // 3 months in days
      default: false,
      applicableUserTypes: ['HoardingOwner', 'BannerUser'],
    },
    {
      name: 'Plan C',
      notes: 'Premium plan for HoardingOwners & BannerUsers - 1 year duration',
      currency: 'INR',
      price: 299,
      userCount: 50,
      gstPercentage: 18,
      discount: 15,
      duration: 365, // 1 year in days
      default: false,
      applicableUserTypes: ['HoardingOwner', 'BannerUser'],
    }
  ];

  const createdPlans = [];

  // Process each plan
  for (const planData of plansToCreate) {
    console.log(`\nProcessing ${planData.name}...`);
    
    // Check if plan with same name already exists
    const existingPlan = await Plan.findOne({ 
      name: planData.name 
    }).lean();

    if (existingPlan) {
      console.log(`Found existing ${planData.name} with id:`, existingPlan._id.toString());
      
      // Update existing plan
      const updateResult = await collection.updateOne(
        { _id: existingPlan._id },
        { 
          $set: planData
        }
      );
      
      if (updateResult.modifiedCount > 0) {
        console.log(`✅ Updated ${planData.name}`);
        createdPlans.push({ ...planData, _id: existingPlan._id });
      } else {
        console.log(`ℹ️ ${planData.name} already up to date`);
        createdPlans.push(existingPlan);
      }
    } else {
      // Insert new plan
      const result = await collection.insertOne(planData);
      if (result && result.insertedId) {
        console.log(`✅ Created ${planData.name} with id:`, result.insertedId.toString());
        createdPlans.push({ ...planData, _id: result.insertedId });
      } else {
        console.warn(`⚠️ Failed to create ${planData.name}`);
      }
    }
  }

  // Ensure only one default plan exists
  const defaultPlans = createdPlans.filter(p => p.default);
  if (defaultPlans.length > 1) {
    console.log('\n⚠️ Multiple default plans found. Setting only Plan A as default...');
    
    // Reset all plans to non-default
    await collection.updateMany(
      {},
      { $set: { default: false } }
    );
    
    // Set only Plan A as default
    const planA = createdPlans.find(p => p.name === 'Plan A');
    if (planA) {
      await collection.updateOne(
        { _id: planA._id },
        { $set: { default: true } }
      );
      console.log('✅ Set Plan A as the only default plan');
    }
  } else if (defaultPlans.length === 0) {
    console.log('\n⚠️ No default plan found. Setting Plan A as default...');
    const planA = createdPlans.find(p => p.name === 'Plan A');
    if (planA) {
      await collection.updateOne(
        { _id: planA._id },
        { $set: { default: true } }
      );
      console.log('✅ Set Plan A as default plan');
    }
  }

  // Summary
  console.log('\n📋 Plan Seeding Summary:');
  console.log('========================');
  createdPlans.forEach(plan => {
    const durationText = plan.duration === 30 ? '1 month' : 
                        plan.duration === 90 ? '3 months' : 
                        '1 year';
    
    console.log(`• ${plan.name}:`);
    console.log(`  - Duration: ${plan.duration} days (${durationText})`);
    console.log(`  - Price: ${plan.currency} ${plan.price}`);
    console.log(`  - Default: ${plan.default ? '✅ Yes' : 'No'}`);
    console.log(`  - Applicable User Types: ${plan.applicableUserTypes.join(', ')}`);
    console.log(`  - User Count Limit: ${plan.userCount}`);
    console.log(`  - Notes: ${plan.notes}`);
  });

  // Important notes
  console.log('\n💡 Important Notes:');
  console.log('===================');
  console.log('1. Plans are applicable to: HoardingOwner and BannerUser only');
  console.log('2. Workers CANNOT use any plans');
  console.log('3. SuperAdmin doesn\'t need plans (full system access)');
  console.log('4. When a HoardingOwner or BannerUser accountStatus changes to "Verified":');
  console.log('   - They should be automatically assigned Plan A (default plan)');
  console.log('   - Plan assignment should be handled in your user verification logic');
}

(async () => {
  try {
    await seedPlan();
    await mongoose.connection.close();
    console.log('\n✅ Plan seeding completed successfully');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding plan failed:', err);
    try {
      await mongoose.connection.close();
      console.log('DB connection closed (after error)');
    } catch (e) {
      console.error('Error closing DB connection after failure:', e);
    }
    process.exit(1);
  }
})();