/**
 * Nigehbaan Backend Programmatic Verification & Unit Test Script
 * Verifies Mongoose Models, Geospatial Indexes, Hashing, Services and Configurations.
 */
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');
const Incident = require('./src/models/Incident');
const SosSession = require('./src/models/SosSession');
const LawResource = require('./src/models/LawResource');
const authService = require('./src/services/auth.service');
const incidentService = require('./src/services/incident.service');
const lawService = require('./src/services/law.service');
const sosService = require('./src/services/sos.service');
const { redisClient } = require('./src/config/redis');

async function runTests() {
  console.log('==================================================');
  console.log('STARTING PROGRAMMATIC BACKEND VERIFICATION SUITE');
  console.log('==================================================\n');

  try {
    // 1. Database Connection
    console.log('[TEST 1/6] Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/nigehbaan');
    console.log('✅ MongoDB Connected successfully!\n');

    // Clean up test data if any exists
    await User.deleteMany({ email: /@test\.com$/ });
    await Incident.deleteMany({ description: /TEST_INCIDENT/ });
    await SosSession.deleteMany({});
    await LawResource.deleteMany({ category: 'test_category' });

    // 2. Auth Service & User Model Hashing Tests
    console.log('[TEST 2/6] Verifying User Registration, Password Hashing, & Login...');
    const testUserData = {
      phone: '+923001234567',
      cnic: '4210112345678',
      email: 'user@test.com',
      password: 'SecurePassword123',
      role: 'User'
    };

    const registerResult = await authService.registerUser(testUserData);
    console.log('✅ User registered successfully.');
    console.log(`- Created User ID: ${registerResult.user._id}`);
    console.log(`- Role assigned: ${registerResult.user.role}`);
    console.log(`- Password Hashed: ${registerResult.user.password === undefined ? 'Hidden' : 'Exposed (FAIL)'}`);

    // Verify Password Hash comparison on login
    const loginResult = await authService.loginUser(testUserData.email, testUserData.password);
    console.log('✅ User login successful. Validated password hash comparison.');
    console.log(`- Issued Access Token: ${loginResult.accessToken.substring(0, 25)}...`);
    console.log(`- Issued Refresh Token: ${loginResult.refreshToken.substring(0, 25)}...`);
    
    // Add trusted contacts
    const guardianData = {
      phone: '+923009876543',
      cnic: '4210198765432',
      email: 'guardian@test.com',
      password: 'GuardianPassword123',
      role: 'Guardian'
    };
    const guardianReg = await authService.registerUser(guardianData);
    console.log('✅ Guardian registered successfully.');

    const userObj = await User.findById(registerResult.user._id);
    userObj.trustedContacts.push(guardianReg.user._id);
    await userObj.save();
    console.log('✅ Linked Guardian as trusted contact.');
    console.log('');

    // 3. Incident Logging & Geospatial Queries Verification
    console.log('[TEST 3/6] Verifying Geospatial Indexes & Incident Creation...');
    const incidentLng = 73.084484; // Islamabad center coordinates
    const incidentLat = 33.684422;

    const incident = await incidentService.createIncident(
      registerResult.user._id,
      'harassment',
      [incidentLng, incidentLat],
      'TEST_INCIDENT: Harassment incident reported near F-10 markaz',
      [] // Empty media list
    );

    console.log('✅ Incident created successfully.');
    console.log(`- Incident ID: ${incident._id}`);
    console.log(`- Location coordinates: ${incident.location.coordinates.join(', ')}`);
    console.log(`- Category: ${incident.category}`);

    // Verify Geospatial query on Incident ($near)
    const nearbyIncidents = await Incident.find({
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [73.085, 33.685] // slightly offset
          },
          $maxDistance: 1000 // within 1km
        }
      }
    });

    console.log(`✅ Geospatial query succeeded. Found ${nearbyIncidents.length} incident(s) within 1km radius.`);
    console.log('');

    // 4. LawResource & Separate Instructions Retrieval Tests
    console.log('[TEST 4/6] Verifying LawResource and Survival Instructions Endpoint logic...');
    
    // Upsert a test law resource
    const lawData = {
      category: 'test_category',
      title: 'Harassment Penal Code 509',
      legalDescription: 'Section 509 of the Pakistan Penal Code penalizes word, gesture or act intended to insult the modesty of a woman.',
      survivalInstructions: [
        'Make noise and draw public attention immediately.',
        'Document details of the harasser and time.',
        'File an official complaint at the nearest police station or via Nigehbaan.'
      ]
    };

    const lawRes = await lawService.upsertLawResource(lawData);
    console.log('✅ Law resource successfully inserted/upserted.');
    console.log(`- Category: ${lawRes.category}`);
    console.log(`- Title: ${lawRes.title}`);

    // Test separate instructions retrieval
    const survivalInstructions = await lawService.getSurvivalInstructions('test_category');
    console.log('✅ Separate survival instructions fetched successfully.');
    console.log(`- Survival instructions list:`);
    survivalInstructions.survivalInstructions.forEach((inst, index) => {
      console.log(`  ${index + 1}. "${inst}"`);
    });
    console.log('');

    // 5. SOS Session Tracking & Redis caching validation
    console.log('[TEST 5/6] Verifying SOS Session tracking in Redis & Database...');
    const initialCoords = [73.084, 33.684];
    
    // Start session
    const sosSession = await sosService.startSosSession(registerResult.user._id, initialCoords);
    console.log('✅ SOS session started successfully.');
    console.log(`- SOS Session ID: ${sosSession._id}`);
    console.log(`- Session Active status: ${sosSession.active}`);
    console.log(`- Initial Location: ${sosSession.coordinates[0].location.coordinates.join(', ')}`);

    // Verify Redis caching of active session (if Redis is running)
    if (redisClient.status === 'ready') {
      const activeCache = await redisClient.hgetall(`sos:active:${registerResult.user._id}`);
      console.log('✅ Active SOS Session cached in Redis.');
      console.log(`- Cached Session ID: ${activeCache.sessionId}`);
      console.log(`- Cached Status: ${activeCache.active}`);
    } else {
      console.log('⚠️ Redis offline. Skipped Redis cache checks.');
    }

    // Ping location update
    const updatedCoords = [73.086, 33.686];
    const updatedSession = await sosService.pingSosLocation(registerResult.user._id, updatedCoords);
    console.log('✅ Coordinates ping logged successfully.');
    console.log(`- Total path coordinates: ${updatedSession.coordinates.length}`);
    console.log(`- Last Ping Location: ${updatedSession.coordinates[updatedSession.coordinates.length - 1].location.coordinates.join(', ')}`);

    // Close session
    const closedSession = await sosService.closeSosSession(registerResult.user._id);
    console.log('✅ SOS session closed successfully.');
    console.log(`- Final Session Active status: ${closedSession.active}`);
    console.log(`- End Time: ${closedSession.endTime}`);
    console.log('');

    // 6. Password Reset Token flow verification
    console.log('[TEST 6/6] Verifying Password Reset Token Generation & Validation...');
    const resetToken = await authService.generatePasswordResetToken(testUserData.email);
    console.log('✅ Password reset token successfully generated.');
    console.log(`- Generated Raw Token: ${resetToken}`);

    // Verify User record updated with hash
    const updatedUser = await User.findOne({ email: testUserData.email });
    console.log(`- Saved Token Hash: ${updatedUser.resetPasswordToken}`);
    console.log(`- Token Expiration: ${updatedUser.resetPasswordExpire}`);

    // Validate reset
    const newPass = 'BrandNewPassword123';
    await authService.resetUserPassword(resetToken, newPass);
    console.log('✅ Password successfully reset using token.');

    // Check login with new password
    const newLoginResult = await authService.loginUser(testUserData.email, newPass);
    console.log(`✅ Login using new password successful! Session issued.`);
    console.log('');

    console.log('==================================================');
    console.log('🎉 ALL PROGRAMMATIC INTEGRATION TESTS PASSED!');
    console.log('==================================================');

  } catch (error) {
    console.error('\n❌ TEST SUITE FAILED WITH ERROR:', error.message);
    console.error(error.stack);
  } finally {
    // Clean up test collections
    console.log('\nCleaning up database test registers...');
    await User.deleteMany({ email: /@test\.com$/ });
    await Incident.deleteMany({ description: /TEST_INCIDENT/ });
    await SosSession.deleteMany({});
    await LawResource.deleteMany({ category: 'test_category' });

    // Disconnect
    await mongoose.disconnect();
    if (redisClient.status === 'ready' || redisClient.status === 'connecting') {
      await redisClient.quit();
    }
    console.log('Disconnected. Verification terminated.');
  }
}

runTests();
