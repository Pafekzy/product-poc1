const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails
} = require('@firebase/rules-unit-testing');
const {
  collection,
  doc,
  getDoc,
  getDocs,
  or,
  query,
  setDoc,
  where
} = require('firebase/firestore');

const PROJECT_ID = 'demo-vericommit-rules';
const RULES = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');

async function main() {
  const env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: RULES }
  });

  try {
    await env.clearFirestore();

    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'funding_agreements', 'fa-query-001'), {
        id: 'fa-query-001',
        title: 'Agreement with participant emails',
        grantorId: 'grantor-1',
        granteeId: 'grantee-1',
        grantorEmail: 'grantor@example.com',
        granteeEmail: 'grantee@example.com',
        status: 'active',
        createdAt: '2026-01-01T00:00:00.000Z'
      });
      await setDoc(doc(db, 'funding_agreements', 'fa-query-002'), {
        id: 'fa-query-002',
        title: 'Agreement without optional emails',
        grantorId: 'grantor-1',
        granteeId: 'grantee-2',
        status: 'active',
        createdAt: '2026-01-02T00:00:00.000Z'
      });
    });

    const grantorDb = env.authenticatedContext('grantor-1', {
      email: 'grantor@example.com',
      email_verified: true
    }).firestore();

    const grantorQuery = query(
      collection(grantorDb, 'funding_agreements'),
      where('grantorId', '==', 'grantor-1')
    );
    const grantorResults = await assertSucceeds(getDocs(grantorQuery));
    assert.equal(grantorResults.size, 2);
    console.log('PASS: grantor UID query returns agreements, including records without optional email fields');

    const granteeDb = env.authenticatedContext('grantee-1', {
      email: 'grantee@example.com',
      email_verified: true
    }).firestore();
    const granteeQuery = query(
      collection(granteeDb, 'funding_agreements'),
      where('granteeId', '==', 'grantee-1')
    );
    const granteeResults = await assertSucceeds(getDocs(granteeQuery));
    assert.equal(granteeResults.size, 1);
    console.log('PASS: grantee UID query returns only the matching agreement');

    const verifiedEmailQuery = query(
      collection(grantorDb, 'funding_agreements'),
      or(
        where('grantorId', '==', 'grantor-1'),
        where('granteeId', '==', 'grantor-1'),
        where('grantorEmail', '==', 'grantor@example.com'),
        where('granteeEmail', '==', 'grantor@example.com')
      )
    );
    const emailResults = await assertSucceeds(getDocs(verifiedEmailQuery));
    assert.equal(emailResults.size, 2);
    console.log('PASS: combined participant UID/email OR query succeeds');

    const emailOnlyDb = env.authenticatedContext('email-only-user', {
      email: 'grantee@example.com',
      email_verified: true
    }).firestore();
    const emailOnlyQuery = query(
      collection(emailOnlyDb, 'funding_agreements'),
      or(
        where('grantorEmail', '==', 'grantee@example.com'),
        where('granteeEmail', '==', 'grantee@example.com')
      )
    );
    const emailResultsOnly = await assertSucceeds(getDocs(emailOnlyQuery));
    assert.equal(emailResultsOnly.size, 1);
    console.log('PASS: verified matching email can query an agreement without a matching UID');

    const unverifiedDb = env.authenticatedContext('unverified-user', {
      email: 'grantee@example.com',
      email_verified: false
    }).firestore();
    await assertFails(getDoc(doc(unverifiedDb, 'funding_agreements', 'fa-query-001')));
    await assertFails(getDocs(query(collection(unverifiedDb, 'funding_agreements'))));
    console.log('PASS: unverified email and unrestricted collection query are denied');

    const unrelatedDb = env.authenticatedContext('unrelated-user', {
      email: 'outsider@example.com',
      email_verified: true
    }).firestore();
    await assertFails(getDoc(doc(unrelatedDb, 'funding_agreements', 'fa-query-001')));
    await assertFails(getDocs(query(
      collection(unrelatedDb, 'funding_agreements'),
      where('grantorId', '==', 'grantor-1')
    )));
    console.log('PASS: unrelated users cannot read participant agreements');

    console.log('\nAll Firestore security regression checks passed.');
  } finally {
    await env.cleanup();
  }
}

main().catch((error) => {
  console.error('Firestore security regression failed:', error);
  process.exitCode = 1;
});
