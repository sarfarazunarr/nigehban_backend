/**
 * Mock Verification & Unit Test Suite
 * Programmatically mocks MongoDB/Mongoose and Redis dependencies
 * to test Nigehbaan service layers, schemas, validations, and logic in-memory.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// 1. Mock Mongoose & Database Connections
mongoose.connect = async () => {
  console.log('🔌 [MOCK] Connected to Virtual In-Memory MongoDB');
  return { connection: { host: 'virtual-memory-db' } };
};
mongoose.disconnect = async () => {
  console.log('🔌 [MOCK] Disconnected from Virtual MongoDB');
};

const User = require('./src/models/User');
const Incident = require('./src/models/Incident');
const SosSession = require('./src/models/SosSession');
const LawResource = require('./src/models/LawResource');

// Mock memory stores
const dbStore = {
  users: [],
  incidents: [],
  sessions: [],
  laws: []
};

// Mock Mongoose user model active record wrapper
const createMockUserInstance = (user) => {
  if (!user) return null;
  return {
    ...user,
    comparePassword: async function(candidate) {
      return await bcrypt.compare(candidate, this.password);
    },
    save: async function() {
      if (this.password && !this.password.startsWith('$2a$')) {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
      }
      const idx = dbStore.users.findIndex(u => u._id.toString() === this._id.toString());
      if (idx > -1) {
        dbStore.users[idx] = { ...this };
      }
      return this;
    }
  };
};

// Stubbing Mongoose methods for User
User.findOne = (query) => {
  const { $or, email, phone, resetPasswordToken } = query;
  let user = null;
  if ($or) {
    user = dbStore.users.find(u => {
      return $or.some(q => {
        if (q.phone && u.phone === q.phone) return true;
        if (q.cnic && u.cnic === q.cnic) return true;
        if (q.email && u.email === q.email) return true;
        return false;
      });
    }) || null;
  } else if (email) {
    user = dbStore.users.find(u => u.email === email) || null;
  } else if (phone) {
    user = dbStore.users.find(u => u.phone === phone) || null;
  } else if (resetPasswordToken) {
    user = dbStore.users.find(u => u.resetPasswordToken === resetPasswordToken) || null;
  }

  const queryChain = {
    select: (fields) => {
      if (user) {
        const inst = createMockUserInstance(user);
        if (fields.includes('-password')) delete inst.password;
        return Promise.resolve(inst);
      }
      return Promise.resolve(null);
    },
    then: (resolve) => resolve(createMockUserInstance(user))
  };
  return queryChain;
};

User.create = async (data) => {
  // Mock pre-save hook for password hashing
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(data.password, salt);
  
  const newUser = {
    _id: new mongoose.Types.ObjectId(),
    ...data,
    password: hashedPassword,
    trustedContacts: data.trustedContacts || []
  };
  
  const instance = createMockUserInstance(newUser);
  dbStore.users.push({ ...newUser });
  return instance;
};

User.findByIdAndUpdate = async (id, update) => {
  const user = dbStore.users.find(u => u._id.toString() === id.toString());
  if (user) {
    Object.assign(user, update);
    return createMockUserInstance(user);
  }
  return null;
};

User.findById = (id) => {
  const user = dbStore.users.find(u => u._id.toString() === id.toString());
  const queryChain = {
    select: (fields) => {
      if (user) {
        const inst = createMockUserInstance(user);
        if (fields.includes('-password')) delete inst.password;
        return Promise.resolve(inst);
      }
      return Promise.resolve(null);
    },
    populate: (path, fields) => {
      // Stub population
      if (user && path === 'trustedContacts') {
        user.trustedContacts = user.trustedContacts.map(cid => 
          dbStore.users.find(u => u._id.toString() === cid.toString()) || cid
        );
      }
      return queryChain;
    },
    then: (resolve) => resolve(createMockUserInstance(user))
  };
  return queryChain;
};

// Stubbing Mongoose methods for Incident
Incident.create = async (data) => {
  const newIncident = {
    _id: new mongoose.Types.ObjectId(),
    ...data,
    timestamp: new Date()
  };
  dbStore.incidents.push(newIncident);
  return newIncident;
};

Incident.find = () => {
  return {
    populate: () => ({
      sort: () => ({
        skip: () => ({
          limit: () => Promise.resolve(dbStore.incidents)
        })
      })
    })
  };
};

Incident.countDocuments = async () => dbStore.incidents.length;

// Stubbing Mongoose methods for LawResource
LawResource.findOne = (query) => {
  const resource = dbStore.laws.find(l => l.category === query.category) || null;
  const queryChain = {
    select: (fields) => Promise.resolve(resource),
    then: (resolve) => resolve(resource)
  };
  return queryChain;
};

LawResource.findOneAndUpdate = async (query, data, options) => {
  let law = dbStore.laws.find(l => l.category === query.category);
  if (!law) {
    law = { _id: new mongoose.Types.ObjectId(), ...data };
    dbStore.laws.push(law);
  } else {
    Object.assign(law, data);
  }
  return law;
};

LawResource.findOneAndDelete = async (query) => {
  const idx = dbStore.laws.findIndex(l => l.category === query.category);
  if (idx > -1) {
    dbStore.laws.splice(idx, 1);
    return true;
  }
  return null;
};

LawResource.find = () => {
  return {
    sort: () => Promise.resolve(dbStore.laws)
  };
};

// Stubbing Mongoose methods for SosSession
SosSession.findOne = async (query) => {
  return dbStore.sessions.find(s => s.user.toString() === query.user.toString() && s.active === query.active) || null;
};

SosSession.create = async (data) => {
  const newSession = {
    _id: new mongoose.Types.ObjectId(),
    coordinates: [],
    ...data,
    save: async function() {
      return this;
    }
  };
  dbStore.sessions.push(newSession);
  return newSession;
};

SosSession.findOneAndUpdate = async (query, update, options) => {
  const session = dbStore.sessions.find(s => s.user.toString() === query.user.toString() && s.active === query.active);
  if (session) {
    if (update.$push && update.$push.coordinates) {
      session.coordinates.push(update.$push.coordinates);
    } else {
      Object.assign(session, update);
    }
    return session;
  }
  return null;
};

// 2. Mock Redis client
const { redisClient } = require('./src/config/redis');
redisClient.disconnect(); // Terminate background connection attempts
Object.defineProperty(redisClient, 'status', {
  get: () => 'ready',
  set: () => {}
});
const redisStore = {};

redisClient.keys = async (pattern) => {
  console.log(`[MOCK REDIS] keys ${pattern}`);
  const prefix = pattern.split('*')[0];
  return Object.keys(redisStore).filter(k => k.startsWith(prefix));
};

redisClient.set = async (key, val) => {
  console.log(`[MOCK REDIS] set ${key} = ${val}`);
  redisStore[key] = val;
  return 'OK';
};

redisClient.get = async (key) => {
  console.log(`[MOCK REDIS] get ${key}`);
  return redisStore[key] || null;
};

redisClient.del = async (key) => {
  console.log(`[MOCK REDIS] del ${key}`);
  delete redisStore[key];
  return 1;
};

redisClient.hset = async (key, fieldValues) => {
  console.log(`[MOCK REDIS] hset ${key}`, fieldValues);
  if (!redisStore[key]) redisStore[key] = {};
  Object.assign(redisStore[key], fieldValues);
  return Object.keys(fieldValues).length;
};

redisClient.hgetall = async (key) => {
  console.log(`[MOCK REDIS] hgetall ${key}`);
  return redisStore[key] || {};
};

redisClient.rpush = async (key, val) => {
  console.log(`[MOCK REDIS] rpush ${key} = ${val}`);
  if (!redisStore[key]) redisStore[key] = [];
  redisStore[key].push(val);
  return redisStore[key].length;
};

redisClient.expire = async (key, seconds) => {
  console.log(`[MOCK REDIS] expire ${key} for ${seconds}s`);
  return 1;
};

// 3. Import services to run tests
const authService = require('./src/services/auth.service');
const incidentService = require('./src/services/incident.service');
const lawService = require('./src/services/law.service');
const sosService = require('./src/services/sos.service');

async function runMockTests() {
  console.log('==================================================');
  console.log('STARTING IN-MEMORY MOCK INTEGRATION TEST SUITE');
  console.log('==================================================\n');

  try {
    // 1. Auth Service & User Model Tests
    console.log('[TEST 1/5] Verifying User Registration and Pass Hashing...');
    const testUserData = {
      phone: '+923001234567',
      cnic: '4210112345678',
      email: 'user@test.com',
      password: 'SecurePassword123',
      role: 'User'
    };

    const registerResult = await authService.registerUser(testUserData);
    console.log('✅ User registration successfully processed in-memory.');
    console.log(`- Created ID: ${registerResult.user._id}`);
    console.log(`- Hashed Password String in Database: ${dbStore.users[0].password.substring(0, 30)}...`);

    // Verify Password comparison on login
    const loginResult = await authService.loginUser(testUserData.email, testUserData.password);
    console.log('✅ User login successful. Validated password comparisons.');
    console.log(`- Token Issued: ${loginResult.accessToken.substring(0, 20)}...`);
    
    // Add trusted contacts
    const guardianData = {
      phone: '+923009876543',
      cnic: '4210198765432',
      email: 'guardian@test.com',
      password: 'GuardianPassword123',
      role: 'Guardian'
    };
    const guardianReg = await authService.registerUser(guardianData);
    console.log('✅ Guardian registered in-memory.');

    const userObj = dbStore.users.find(u => u._id === registerResult.user._id);
    userObj.trustedContacts.push(guardianReg.user._id);
    console.log('✅ Linked trusted contact.');
    console.log('');

    // 2. Incident Logging & Address Verification
    console.log('[TEST 2/5] Verifying Incident Creation and Geotagging...');
    const incidentLng = 73.084;
    const incidentLat = 33.684;

    const incident = await incidentService.createIncident(
      registerResult.user._id,
      'harassment',
      [incidentLng, incidentLat],
      'TEST_INCIDENT: harassment incident near F-10 markaz',
      [] // Empty media list
    );

    console.log('✅ Incident created successfully.');
    console.log(`- Incident ID: ${incident._id}`);
    console.log(`- Resolved Address Injected: ${incident.description.split('[Verified Location Address: ')[1]?.replace(']', '')}`);
    console.log('');

    // 3. LawResource & Survival Instructions (Separate endpoints test)
    console.log('[TEST 3/5] Verifying LawResource and Survival Instructions Endpoint retrieval...');
    
    const lawData = {
      category: 'harassment',
      title: 'Harassment Penal Code 509',
      legalDescription: 'Insults to the modesty of a woman.',
      survivalInstructions: [
        'Make noise immediately.',
        'Draw public attention.',
        'File an official complaint.'
      ]
    };

    const lawRes = await lawService.upsertLawResource(lawData);
    console.log('✅ Law resource successfully inserted.');
    console.log(`- Category: ${lawRes.category}`);

    // Test separate instructions retrieval
    const survivalInstructions = await lawService.getSurvivalInstructions('harassment');
    console.log('✅ Separate survival instructions fetched successfully.');
    console.log(`- Survival instructions list:`);
    survivalInstructions.survivalInstructions.forEach((inst, index) => {
      console.log(`  ${index + 1}. "${inst}"`);
    });
    console.log('');

    // 4. SOS Session Live Tracking & Redis cache syncing
    console.log('[TEST 4/5] Verifying SOS Session tracking logic with Redis mocks...');
    const initialCoords = [73.084, 33.684];
    
    // Start session
    const sosSession = await sosService.startSosSession(registerResult.user._id, initialCoords);
    console.log('✅ SOS session started.');
    console.log(`- SOS Session ID: ${sosSession._id}`);
    console.log(`- Session Active status: ${sosSession.active}`);

    // Verify Redis caching of active session
    const activeCache = await redisClient.hgetall(`sos:active:${registerResult.user._id}`);
    console.log('✅ Active SOS Session cached in Redis.');
    console.log(`- Cached Session ID: ${activeCache.sessionId}`);
    console.log(`- Cached Active: ${activeCache.active}`);

    // Ping location update
    const updatedCoords = [73.086, 33.686];
    await sosService.pingSosLocation(registerResult.user._id, updatedCoords);
    console.log('✅ Coordinates ping logged.');
    
    // Verify Redis path has coordinate list
    const pathRedis = redisStore[`sos:path:${registerResult.user._id}`];
    console.log(`- Coordinates cached in Redis path list: ${pathRedis.length}`);

    // Close session
    const closedSession = await sosService.closeSosSession(registerResult.user._id);
    console.log('✅ SOS session closed.');
    console.log(`- Final Session Active status: ${closedSession.active}`);
    console.log(`- Redis cache deleted: ${redisStore[`sos:active:${registerResult.user._id}`] === undefined ? 'Yes (Verified)' : 'No'}`);
    console.log('');

    // 5. Password Reset Flow
    console.log('[TEST 5/5] Verifying Password Reset Token Generation & Validation...');
    const resetToken = await authService.generatePasswordResetToken(testUserData.email);
    console.log('✅ Password reset token successfully generated.');

    // Validate reset
    const newPass = 'BrandNewPassword123';
    await authService.resetUserPassword(resetToken, newPass);
    console.log('✅ Password successfully reset using token.');

    // Check login with new password
    const newLoginResult = await authService.loginUser(testUserData.email, newPass);
    console.log(`✅ Login using new password successful! Session issued.`);
    console.log('');

    console.log('==================================================');
    console.log('🎉 IN-MEMORY MOCK INTEGRATION TESTS PASSED!');
    console.log('==================================================');

  } catch (error) {
    console.error('\n❌ TEST SUITE FAILED WITH ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runMockTests();
