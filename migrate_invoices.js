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

async function migrateInvoices() {
  console.log('Migrating invoices...');
  
  let totalMigrated = 0;
  let lastDoc = null;
  
  while (true) {
    let query = firestore.collection('invoices').limit(50);
    if (lastDoc) query = query.startAfter(lastDoc);
    
    const snapshot = await query.get();
    if (snapshot.empty) break;
    
    const invoicesData = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      invoicesData.push({
        invoice_no: data.invoiceNo,
        customer: data.customer,
        phone: data.phone || '',
        lines: data.lines || [],
        total: data.total,
        bill_discount: data.billDiscount || 0,
        date: data.date,
        created_at: data.createdAt || data.date,
        user_id: data.userId
      });
    });
    
    if (invoicesData.length > 0) {
      const { error } = await supabase.from('invoices').insert(invoicesData);
      if (error) {
        console.error('Error:', error);
        break;
      }
      totalMigrated += invoicesData.length;
      console.log(`✅ Migrated ${invoicesData.length} invoices (Total: ${totalMigrated})`);
    }
    
    lastDoc = snapshot.docs[snapshot.docs.length - 1];
  }
  
  console.log(`🎉 Complete: ${totalMigrated} invoices migrated`);
}

migrateInvoices().then(() => process.exit(0));