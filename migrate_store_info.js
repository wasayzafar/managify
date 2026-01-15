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

async function migrateStoreInfo() {
  console.log('Migrating store info...');
  
  const snapshot = await firestore.collection('storeInfo').get();
  let totalMigrated = 0;
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const storeData = {
      store_name: data.storeName || 'Managify',
      phone: data.phone || '',
      address: data.address || '',
      email: data.email || '',
      website: data.website || '',
      tax_number: data.taxNumber || '',
      logo: data.logo || '',
      user_id: data.userId
    };
    
    const { error } = await supabase.from('store_info').upsert(storeData);
    if (error) {
      console.error('Error:', error);
    } else {
      totalMigrated++;
      console.log(`✅ Migrated store info for user: ${data.userId}`);
    }
  }
  
  console.log(`🎉 Complete: ${totalMigrated} store info records migrated`);
}

migrateStoreInfo().then(() => process.exit(0));