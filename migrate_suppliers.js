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

async function migrateSuppliers() {
  console.log('Migrating suppliers...');
  
  const snapshot = await firestore.collection('suppliers').get();
  const suppliersData = [];
  
  snapshot.forEach(doc => {
    const data = doc.data();
    suppliersData.push({
      supplier_id: data.supplierId || Math.floor(1000 + Math.random() * 9000).toString(),
      name: data.name,
      phone: data.phone || '',
      address: data.address || '',
      created_at: data.createdAt || new Date().toISOString(),
      user_id: data.userId
    });
  });
  
  if (suppliersData.length > 0) {
    const { error } = await supabase.from('suppliers').insert(suppliersData);
    if (error) {
      console.error('Error:', error);
    } else {
      console.log(`✅ Migrated ${suppliersData.length} suppliers`);
    }
  }
  
  console.log(`🎉 Complete: ${suppliersData.length} suppliers migrated`);
}

migrateSuppliers().then(() => process.exit(0));