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

async function migrateSalesCorrect() {
  // Get existing items mapping
  const { data: supabaseItems } = await supabase.from('items').select('id, sku, name');
  const itemMapping = new Map();
  
  // Create Firebase items mapping first
  const fbItemsSnapshot = await firestore.collection('items').get();
  const fbToSbItemMap = new Map();
  
  fbItemsSnapshot.forEach(doc => {
    const fbItem = doc.data();
    const matchingItem = supabaseItems.find(item => 
      item.sku === fbItem.sku && item.name === fbItem.name
    );
    if (matchingItem) {
      fbToSbItemMap.set(doc.id, matchingItem.id);
    }
  });
  
  console.log(`Created mapping for ${fbToSbItemMap.size} items`);
  
  // Migrate sales
  let totalMigrated = 0;
  const snapshot = await firestore.collection('sales').get();
  
  const salesData = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    const supabaseItemId = fbToSbItemMap.get(data.itemId);
    
    if (supabaseItemId) {
      salesData.push({
        item_id: supabaseItemId,
        quantity: data.quantity,
        actual_price: data.actualPrice,
        original_price: data.originalPrice,
        item_discount: data.itemDiscount || 0,
        bill_discount: data.billDiscount || 0,
        customer_name: data.customerName || '',
        customer_phone: data.customerPhone || '',
        invoice_no: data.invoiceNo,
        date: data.date,
        user_id: data.userId
      });
    }
  });
  
  console.log(`Found ${salesData.length} sales to migrate`);
  
  if (salesData.length > 0) {
    for (let i = 0; i < salesData.length; i += 50) {
      const batch = salesData.slice(i, i + 50);
      const { error } = await supabase.from('sales').insert(batch);
      
      if (error) {
        console.error('Error:', error);
        break;
      }
      
      totalMigrated += batch.length;
      console.log(`✅ Migrated ${batch.length} sales (Total: ${totalMigrated})`);
    }
  }
  
  console.log(`🎉 Migration complete: ${totalMigrated} sales`);
}

migrateSalesCorrect().then(() => process.exit(0));