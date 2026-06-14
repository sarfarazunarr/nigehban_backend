const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');

const email = 'sarfarazunarr@gmail.com';
const password = 'sarfaraz';
const phone = '+923009999999';
const cnic = '4210199999999';
const role = 'SuperAdmin';

async function createAdmin() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected.');

    // Remove old user if exists
    await User.deleteMany({ email });
    // Also remove by phone or cnic if they conflict
    await User.deleteMany({ phone });
    await User.deleteMany({ cnic });

    console.log('Creating Admin User...');
    const user = await User.create({
      phone,
      cnic,
      email,
      password,
      role
    });

    console.log('✅ Admin User created successfully!');
    console.log(`- ID: ${user._id}`);
    console.log(`- Email: ${user.email}`);
    console.log(`- Role: ${user.role}`);
    console.log(`- Phone: ${user.phone}`);
    console.log(`- CNIC: ${user.cnic}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to create admin user:', error);
    process.exit(1);
  }
}

createAdmin();
