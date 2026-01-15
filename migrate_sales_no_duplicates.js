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

async function migrateSalesNoDuplicates() {
  console.log('Checking for existing sales...');
  
  const { count } = await supabase
    .from('sales')
    .select('*', { count: 'exact', head: true });
    
  if (count > 0) {
    console.log(`Found ${count} existing sales. Clearing to avoid duplicates...`);
    await supabase.from('sales').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  }
  
  // Get item mapping
  const { data: supabaseItems } = await supabase.from('items').select('id, sku, name');
  const itemMapping = new Map();
  
  supabaseItems.forEach(item => {
    itemMapping.set(`${item.sku}-${item.name}`, item.id);
  });
  
  // Migrate sales
  let totalMigrated = 0;
  const snapshot = await firestore.collection('sales').get();
  
  const salesData = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    const itemKey = `${data.sku || ''}-${data.name || ''}`;
    const supabaseItemId = itemMapping.get(itemKey);
    
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

migrateSalesNoDuplicates().then(() => process.exit(0));