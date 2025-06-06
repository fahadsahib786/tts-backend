// backend/scripts/seed.js
'use strict';
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../src/models/User');
const Plan = require('../src/models/Plan');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB connected for seeding');
  } catch (error) {
    console.error('❌ Database connection error:', error);
    process.exit(1);
  }
};

const seedPlans = async () => {
  try {
    console.log('🌱 Seeding subscription plans...');
    await Plan.deleteMany({});

    const plans = [
      {
        name: 'Free Trial',
        description: 'Try our service with limited features',
        price: 0,
        duration: 'monthly',
        features: {
          charactersPerMonth: 5000,
          voicesAvailable: 1,
          audioFormats: ['mp3'],
          apiAccess: false,
          prioritySupport: false,
          commercialUse: false,
        },
        isActive: true,
        isTrial: true,
        trialDays: 7,
      },
      {
        name: 'Basic',
        description: 'Perfect for personal use and small projects',
        price: 9.99,
        duration: 'monthly',
        features: {
          charactersPerMonth: 50000,
          voicesAvailable: 1,
          audioFormats: ['mp3', 'wav'],
          apiAccess: false,
          prioritySupport: false,
          commercialUse: false,
        },
        isActive: true,
        isTrial: false,
      },
      {
        name: 'Professional',
        description: 'Ideal for businesses and content creators',
        price: 29.99,
        duration: 'monthly',
        features: {
          charactersPerMonth: 200000,
          voicesAvailable: 2,
          audioFormats: ['mp3', 'wav', 'ogg'],
          apiAccess: true,
          prioritySupport: true,
          commercialUse: true,
        },
        isActive: true,
        isTrial: false,
        isPopular: true,
      },
      {
        name: 'Enterprise',
        description: 'For large organizations with high volume needs',
        price: 99.99,
        duration: 'monthly',
        features: {
          charactersPerMonth: 1000000,
          voicesAvailable: 3,
          audioFormats: ['mp3', 'wav', 'ogg'],
          apiAccess: true,
          prioritySupport: true,
          commercialUse: true,
        },
        isActive: true,
        isTrial: false,
      },
      {
        name: 'Basic Annual',
        description: 'Basic plan with annual billing (2 months free)',
        price: 99.99,
        duration: 'yearly',
        features: {
          charactersPerMonth: 50000,
          voicesAvailable: 1,
          audioFormats: ['mp3', 'wav'],
          apiAccess: false,
          prioritySupport: false,
          commercialUse: false,
        },
        isActive: true,
        isTrial: false,
        discount: 20,
      },
      {
        name: 'Professional Annual',
        description: 'Professional plan with annual billing (2 months free)',
        price: 299.99,
        duration: 'yearly',
        features: {
          charactersPerMonth: 200000,
          voicesAvailable: 2,
          audioFormats: ['mp3', 'wav', 'ogg'],
          apiAccess: true,
          prioritySupport: true,
          commercialUse: true,
        },
        isActive: true,
        isTrial: false,
        isPopular: true,
        discount: 20,
      },
    ];

    const createdPlans = await Plan.insertMany(plans);
    console.log(`✅ Created ${createdPlans.length} subscription plans`);
    return createdPlans;
  } catch (error) {
    console.error('❌ Error seeding plans:', error);
    throw error;
  }
};

const seedUsers = async () => {
  try {
    console.log('🌱 Seeding users...');
    await User.deleteMany({});

    const users = [
      {
        firstName: 'Super',
        lastName: 'Admin',
        email: process.env.SUPER_ADMIN_EMAIL || 'superadmin@ttsplatform.com',
        password: await bcrypt.hash('SuperAdmin123!', 12),
        role: 'admin',
        phone: '+1234567890',
        isEmailVerified: true,
      },
      {
        firstName: 'Admin',
        lastName: 'User',
        email: process.env.ADMIN_EMAIL || 'admin@ttsplatform.com',
        password: await bcrypt.hash('Admin123!', 12),
        role: 'admin',
        phone: '+1234567891',
        isEmailVerified: true,
      },
      {
        firstName: 'Finance',
        lastName: 'Admin',
        email: 'finance@ttsplatform.com',
        password: await bcrypt.hash('Finance123!', 12),
        role: 'admin',
        phone: '+1234567892',
        isEmailVerified: true,
      },
      {
        firstName: 'Manager',
        lastName: 'User',
        email: 'manager@ttsplatform.com',
        password: await bcrypt.hash('Manager123!', 12),
        role: 'manager',
        phone: '+1234567893',
        isEmailVerified: true,
      },
      {
        firstName: 'Test',
        lastName: 'User',
        email: 'user@ttsplatform.com',
        password: await bcrypt.hash('User123!', 12),
        role: 'user',
        phone: '+1234567894',
        isEmailVerified: true,
      },
      {
        firstName: 'Demo',
        lastName: 'User',
        email: 'demo@ttsplatform.com',
        password: await bcrypt.hash('Demo123!', 12),
        role: 'user',
        phone: '+1234567895',
        isEmailVerified: true,
      },
    ];

    const createdUsers = await User.insertMany(users);
    console.log(`✅ Created ${createdUsers.length} users`);

    console.log('\n📋 Login Credentials:');
    console.log('=====================================================');
    createdUsers.forEach((userDoc) => {
      let password = '';
      switch (userDoc.email) {
        case process.env.SUPER_ADMIN_EMAIL || 'superadmin@ttsplatform.com':
          password = 'SuperAdmin123!';
          break;
        case process.env.ADMIN_EMAIL || 'admin@ttsplatform.com':
          password = 'Admin123!';
          break;
        case 'finance@ttsplatform.com':
          password = 'Finance123!';
          break;
        case 'manager@ttsplatform.com':
          password = 'Manager123!';
          break;
        case 'user@ttsplatform.com':
          password = 'User123!';
          break;
        case 'demo@ttsplatform.com':
          password = 'Demo123!';
          break;
      }
      console.log(
        `${userDoc.role.toUpperCase().padEnd(15)} | ${userDoc.email.padEnd(25)} | ${password}`
      );
    });
    console.log('=====================================================');

    return createdUsers;
  } catch (error) {
    console.error('❌ Error seeding users:', error);
    throw error;
  }
};

const seedDatabase = async () => {
  try {
    console.log('🚀 Starting database seeding...\n');
    await connectDB();

    const plans = await seedPlans();
    const users = await seedUsers();

    console.log('\n🎉 Database seeding completed successfully!');
    console.log(`   • Plans created: ${plans.length}`);
    console.log(`   • Users created: ${users.length}\n`);
    console.log('🌐 Your API is now ready at http://localhost:5000/api');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔒 Database connection closed');
    process.exit(0);
  }
};

const args = process.argv.slice(2);
const seedType = args[0];

if (seedType === 'plans') {
  connectDB()
    .then(seedPlans)
    .then(() => {
      console.log('✅ Plans seeded successfully');
      return mongoose.connection.close();
    })
    .catch((error) => {
      console.error('❌ Plans seeding failed:', error);
      process.exit(1);
    });
} else if (seedType === 'users') {
  connectDB()
    .then(seedUsers)
    .then(() => {
      console.log('✅ Users seeded successfully');
      return mongoose.connection.close();
    })
    .catch((error) => {
      console.error('❌ Users seeding failed:', error);
      process.exit(1);
    });
} else {
  seedDatabase();
}

module.exports = {
  seedPlans,
  seedUsers,
  seedDatabase,
};
