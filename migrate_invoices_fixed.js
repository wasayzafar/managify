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

function formatDate(dateStr) {
  if (!dateStr) return new Date().toISOString();
  
  // If already ISO format
  if (dateStr.includes('T') && dateStr.includes('Z')) {
    return dateStr;
  }
  
  // Try to parse and convert to ISO
  try {
    const date = new Date(dateStr);
    return date.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

async function migrateInvoicesFixed() {
  // Clear existing invoices first
  await supabase.from('invoices').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  
  console.log('Migrating invoices with fixed dates...');
  
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
        date: formatDate(data.date),
        created_at: formatDate(data.createdAt || data.date),
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

migrateInvoicesFixed().then(() => process.exit(0));