import admin from 'firebase-admin';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./firebase-service-account.json', 'utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const firestore = admin.firestore();
const supabase = createClient(
  'https://eooulfvbllitlhjzilit.supabase.co',
  'sb_secret__dk16inwSwFU45qCE2sMwA_kESOiPAx'
);

async function migrateExpenses() {
  console.log('Migrating expenses...');
  
  const snapshot = await firestore.collection('expenses').get();
  const expensesData = [];
  
  snapshot.forEach(doc => {
    const data = doc.data();
    expensesData.push({
      type: data.type,
      amount: data.amount,
      description: data.description || '',
      date: data.date,
      user_id: data.userId
    });
  });
  
  if (expensesData.length > 0) {
    const { error } = await supabase.from('expenses').insert(expensesData);
    if (error) {
      console.error('Error:', error);
    } else {
      console.log(`✅ Migrated ${expensesData.length} expenses`);
    }
  }
  
  console.log(`🎉 Complete: ${expensesData.length} expenses migrated`);
}

migrateExpenses().then(() => process.exit(0));