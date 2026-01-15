const admin = require('firebase-admin');
const { createClient } = require('@supabase/supabase-js');

// Firebase Admin SDK setup
const serviceAccount = require('./firebase-service-account.json'); // Download from Firebase Console
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const firestore = admin.firestore();

// Supabase setup
const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseServiceKey = 'YOUR_SUPABASE_SERVICE_ROLE_KEY'; // Use service role key, not anon key
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Field mapping from Firebase to Supabase
const fieldMappings = {
  items: {
    'createdAt': 'created_at'
  },
  purchases: {
    'itemId': 'item_id',
    'costPrice': 'cost_price',
    'supplierPhone': 'supplier_phone'
  },
  sales: {
    'itemId': 'item_id',
    'actualPrice': 'actual_price',
    'originalPrice': 'original_price',
    'itemDiscount': 'item_discount',
    'billDiscount': 'bill_discount',
    'customerName': 'customer_name',
    'customerPhone': 'customer_phone',
    'invoiceNo': 'invoice_no'
  },
  storeInfo: {
    'storeName': 'store_name',
    'taxNumber': 'tax_number'
  },
  employees: {
    'firstMonthPay': 'first_month_pay',
    'joinDate': 'join_date'
  },
  invoices: {
    'invoiceNo': 'invoice_no',
    'billDiscount': 'bill_discount',
    'createdAt': 'created_at'
  },
  suppliers: {
    'supplierId': 'supplier_id',
    'createdAt': 'created_at'
  }
};

function mapFields(data, mapping) {
  const mapped = { ...data };
  for (const [oldField, newField] of Object.entries(mapping)) {
    if (mapped[oldField] !== undefined) {
      mapped[newField] = mapped[oldField];
      delete mapped[oldField];
    }
  }
  return mapped;
}

async function migrateCollection(collectionName, tableName) {
  console.log(`Migrating ${collectionName}...`);
  
  try {
    const snapshot = await firestore.collection(collectionName).get();
    const docs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log(`Found ${docs.length} documents in ${collectionName}`);

    if (docs.length === 0) return;

    // Map fields and add user_id
    const mappedDocs = docs.map(doc => {
      let mapped = mapFields(doc, fieldMappings[collectionName] || {});
      
      // Add user_id field (use userId from document or a default)
      mapped.user_id = mapped.userId || 'DEFAULT_USER_ID'; // Replace with actual user ID
      delete mapped.userId;

      // Handle special cases
      if (tableName === 'store_info') {
        // Ensure only one store_info per user
        delete mapped.id; // Let Supabase generate new ID
      }

      return mapped;
    });

    // Insert in batches of 100
    const batchSize = 100;
    for (let i = 0; i < mappedDocs.length; i += batchSize) {
      const batch = mappedDocs.slice(i, i + batchSize);
      
      const { data, error } = await supabase
        .from(tableName)
        .insert(batch);

      if (error) {
        console.error(`Error inserting batch for ${tableName}:`, error);
      } else {
        console.log(`Inserted batch ${Math.floor(i/batchSize) + 1} for ${tableName}`);
      }
    }

    console.log(`✅ Completed migration of ${collectionName}`);
  } catch (error) {
    console.error(`❌ Error migrating ${collectionName}:`, error);
  }
}

async function migrateAllData() {
  console.log('🚀 Starting Firebase to Supabase migration...\n');

  // Migration order matters due to foreign key constraints
  const migrations = [
    { collection: 'items', table: 'items' },
    { collection: 'purchases', table: 'purchases' },
    { collection: 'sales', table: 'sales' },
    { collection: 'storeInfo', table: 'store_info' },
    { collection: 'expenses', table: 'expenses' },
    { collection: 'employees', table: 'employees' },
    { collection: 'invoices', table: 'invoices' },
    { collection: 'suppliers', table: 'suppliers' }
  ];

  for (const { collection, table } of migrations) {
    await migrateCollection(collection, table);
    console.log(''); // Empty line for readability
  }

  console.log('🎉 Migration completed!');
  process.exit(0);
}

// Run migration
migrateAllData().catch(console.error);