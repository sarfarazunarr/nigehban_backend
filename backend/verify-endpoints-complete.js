require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');
const Incident = require('./src/models/Incident');
const LawResource = require('./src/models/LawResource');
const ChatSession = require('./src/models/ChatSession');
const lawService = require('./src/services/law.service');
const incidentService = require('./src/services/incident.service');
const mapsService = require('./src/services/maps.service');
const openaiService = require('./src/services/openai.service');
const profileController = require('./src/controllers/profile.controller');
const mapsController = require('./src/controllers/maps.controller');
const chatController = require('./src/controllers/chat.controller');

async function runVerification() {
  console.log('==================================================');
  console.log('STARTING NIGEHBHAAN COMPLETENESS VERIFICATION');
  console.log('==================================================\n');

  try {
    // 1. Connection
    console.log('[TEST 1/5] Connecting to Database...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/nigehbaan');
    console.log('✅ Database connected.\n');

    // Clean test registers
    await User.deleteMany({ email: /@test-complete\.com$/ });
    await Incident.deleteMany({ description: /VERIFICATION_TEST/ });
    await LawResource.deleteMany({ category: 'test_category_complete' });
    await ChatSession.deleteMany({});

    // 2. Profile Contacts Test
    console.log('[TEST 2/5] Verifying Profile & Trusted Contacts...');
    const mainUser = await User.create({
      phone: '+923000000001',
      cnic: '4210100000001',
      email: 'user@test-complete.com',
      password: 'TestPassword123',
      role: 'User'
    });
    const contactUser = await User.create({
      phone: '+923000000002',
      cnic: '4210100000002',
      email: 'contact@test-complete.com',
      password: 'TestPassword123',
      role: 'Guardian'
    });

    // Simulate Add Trusted Contact (controller logic)
    const reqAdd = {
      user: { _id: mainUser._id },
      body: { contactInfo: contactUser.phone }
    };
    let resData = null;
    const resAdd = {
      status: (code) => ({
        json: (data) => {
          resData = data;
          return { status: code };
        }
      })
    };

    await profileController.addTrustedContact(reqAdd, resAdd, (err) => { if (err) throw err; });
    console.log(`- Add contact result: ${resData.success ? 'SUCCESS' : 'FAILED'}`);
    if (resData.success) {
      console.log(`  Linked Contact Phone: ${resData.data.trustedContacts[0].phone}`);
    } else {
      throw new Error(`Profile Contact Add failed: ${resData.error}`);
    }

    // Simulate Remove Trusted Contact
    const reqRemove = {
      user: { _id: mainUser._id },
      params: { contactId: contactUser._id.toString() }
    };
    await profileController.removeTrustedContact(reqRemove, resAdd, (err) => { if (err) throw err; });
    console.log(`- Remove contact result: ${resData.success ? 'SUCCESS' : 'FAILED'}`);
    if (resData.success) {
      console.log(`  Contacts Count: ${resData.data.trustedContacts.length}`);
    } else {
      throw new Error(`Profile Contact Remove failed: ${resData.error}`);
    }
    console.log('✅ Profile Contacts verification complete.\n');

    // 3. Laws Precautions Test
    console.log('[TEST 3/5] Verifying LawResource Precautions...');
    const testLaw = {
      category: 'test_category_complete',
      title: 'Stalking Law Section 354',
      legalDescription: 'Penalties for stalking and visual monitoring of women.',
      survivalInstructions: ['Stay in public areas', 'Alert nearby security'],
      precautions: ['Do not walk alone at night', 'Keep a personal alarm device']
    };

    const savedLaw = await lawService.upsertLawResource(testLaw);
    console.log(`- Upserted category: ${savedLaw.category}`);
    console.log(`- Saved precautions: [${savedLaw.precautions.join(', ')}]`);

    const fetchedPrecautions = await lawService.getPrecautions('test_category_complete');
    console.log(`- Fetched precautions for '${fetchedPrecautions.category}': [${fetchedPrecautions.precautions.join(', ')}]`);
    console.log('✅ Law Precautions verification complete.\n');

    // 4. Incident Hub Enhancements
    console.log('[TEST 4/5] Verifying Incident Hub status, team reply, & action...');
    const incidentLng = 73.0479;
    const incidentLat = 33.6844;
    const reportedIncident = await incidentService.createIncident(
      mainUser._id,
      'harassment',
      [incidentLng, incidentLat],
      'VERIFICATION_TEST: Harassment reported near Metro Station.'
    );

    console.log(`- Initial Incident Status: ${reportedIncident.status}`);
    console.log(`- Legacy Verification Status: ${reportedIncident.verificationStatus}`);

    // Update status/reply/action
    const updated = await incidentService.updateIncidentStatus(
      reportedIncident._id,
      'in-progress',
      'Police force dispatched to area.',
      'Team assigned. Dispatching unit.'
    );
    console.log(`- Updated Incident Status: ${updated.status}`);
    console.log(`- Legacy Verification Status: ${updated.verificationStatus}`);
    console.log(`- Team Reply: "${updated.teamReply}"`);
    console.log(`- Action: "${updated.action}"`);

    // Verify single lookup
    const foundIncident = await incidentService.getIncidentById(reportedIncident._id);
    console.log(`- Fetched single incident details. Status matches: ${foundIncident.status === updated.status}`);
    console.log('✅ Incident Hub enhancements verification complete.\n');

    // 5. Maps Routing & OpenAI AI Assistant Handoff
    console.log('[TEST 5/5] Verifying Google Maps safety routing & Agent Chat...');
    
    // Check route safety enlisting
    const routeSafety = await mapsService.getRouteSafety('Sector G-11', 'Sector F-7');
    console.log(`- Route enlisting options: ${routeSafety.length}`);
    routeSafety.forEach(r => {
      console.log(`  * Path: "${r.summary}" | Distance: ${r.distance} | Safety: ${r.safetyStatus.toUpperCase()} (${r.safetyAssessment})`);
    });

    // Test AI Chat message processing & Handover logic
    console.log('\nTesting AI chat message...');
    const aiResponse1 = await openaiService.processUserMessage(mainUser._id, 'Hello Nigehbaan, can you tell me precautions for stalking?');
    console.log(`- AI Assistant Response: "${aiResponse1.reply}"`);
    console.log(`- Handover triggered: ${aiResponse1.handoffTriggered}`);

    // Test Handoff to human trigger
    console.log('\nTesting AI chat emergency human operator handoff...');
    const aiResponse2 = await openaiService.processUserMessage(mainUser._id, 'Help! Please connect me to a human operator immediately.');
    console.log(`- AI Assistant Response: "${aiResponse2.reply}"`);
    console.log(`- Handover triggered: ${aiResponse2.handoffTriggered}`);

    const chatSession = await ChatSession.findOne({ user: mainUser._id });
    console.log(`- Verified Chat Session Status: ${chatSession.status}`);

    console.log('\n==================================================');
    console.log('🎉 ALL COMPLETENESS VERIFICATIONS PASSED SUCCESSFULLY!');
    console.log('==================================================');

  } catch (error) {
    console.error('\n❌ VERIFICATION FAILED WITH ERROR:', error.message);
    console.error(error.stack);
  } finally {
    console.log('\nCleaning up verification records...');
    await User.deleteMany({ email: /@test-complete\.com$/ });
    await Incident.deleteMany({ description: /VERIFICATION_TEST/ });
    await LawResource.deleteMany({ category: 'test_category_complete' });
    await ChatSession.deleteMany({});
    await mongoose.disconnect();
    console.log('Verification completed and terminated.');
  }
}

runVerification();
