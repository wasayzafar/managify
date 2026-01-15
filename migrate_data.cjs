const admin = require('firebase-admin');
const { createClient } = require('@supabase/supabase-js');

// Firebase setup
const serviceAccount = {
  "type": "service_account",
  "project_id": "managify608",
  "private_key_id": "4c52d05e13783a5568e31ed73cc829c6d073be5e",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQC+SfiLgwHvVnj1\ntDYnmuRESzvuGMndipBTensdqhJD97prwLBj4ukL9JbLixx+KRZ5rR4TUV4sGb9H\nb46/f5NKdVpDIxkW1yHnYI82U0inRqYw35dHVv22xlgCiSGGF7eyQSVzq7/9Lyup\nqj/OpPbMZAC+lJ7IDm5UGPbZxo7t4SR3VW8cR4+AJHOmDbNJTDBzGZgY0kMMg6vT\n+sj/PlLi2oegwm1a+Xbhk+/HJ0DFvEL74uaVGc/foje/HSPzJ+A2Sy0rOVC9e2zv\nkfFvgPsRID5nh9hpiVyTnifWl8pA67SEWyjiG3GZoq2cHJheJD1bz+Od8+2sAIx2\n9IT2L2ivAgMBAAECggEAPaXZT9lxlwh8x51KrioQKc/16n09aPirKWBU4pdms35e\ndupGOxYYSjdDY03+PSEyltjvFXMW/1KYFZyesouyPD0osPd9+VhZM4yk2QTCVO8e\niFbnu8UDDWPUv32NztOAP8+7Qm4yFORjUORHJ7tp+W2skBG2HzoNpFEyJ/ub8pSf\nHxTP9XvXTfVJmE+U8MBFgg5+XiH7gxcWtnpidytvPs/7Jq9V7B5deaX8SLJBKw14\nq2SyjG6/vTFFMvFEXegQRkcpu8EGQTwhuiK4KkgYlyZF/kIsOUolORxJs79tLHhw\nAs1+tuvdt/l0fD8FDj4fcNtxPpN5vm1Wiw7dhzG/gQKBgQDh8PX8PKn1PkRJaWnW\n1LpjG5ueIcIoe3eqrcgegGHBk16+qbTRZcsIfzvllaDvll6rP7Nd+sewqjcVBWkd\nwyeVu/AKSGdP2LkTFhAkp0ceQQbGk5dch2iRWrNt+9GvOr758wz2xPHJeVDmFQOV\nd7xPzM1q4Hc2Ngb6mSQc66PbhQKBgQDXmsZI4vIjfuDYeCP9ogjy7rC1U9n4jVmh\nr1kkNP/8pC7iWYHJJ6x7mUiI9JSquw2uMw3MTYZBZ18lYBywiuhkJ+QbU71WVAsL\nczUvNKRRV+0hu4iRi26Om3qbkPhAsTlPjnEYZx1ycv57cy9fuc3Q046A6i/V6y7B\nOP+RQJIHowKBgHUOxEL0oxFeOz7VkHIvMIncadmZn+AdZ7hT5NR4qy0BTxr1DatX\nU8OJN90QkprOiymqDSHppb/P0E3hyb4Tt9SJ1Clfrbbej7Rlv+NdjykLg5kqKkdU\nGEcGeOPIjbB9fSg+Vj8bdjFt2w35YSv1JukpMFvpA5pgj2kSInWhV/mJAoGAauEm\n+mrGbiIvhB/Kd6kjlooMv1bZ7wTjMeui3PgJDky1kS+dzwID1yGde4cDS79+gKR+\napDjxPhhij2i+0FhAoVj5sgUS/9Nmld6PfRyoIBd5SL6CGx+WeNpXET5S9iO+Ik8\nN0SmrF2lGb139pQ9GxBEzFNLc1gqzU5cIr1HptECgYAd6WlKUjeTMmt0H1GOXXf9\nlZrDb2ioq0xt/VUr0duZgKc5A8QcoDWsGA+U7vJuAlA2o2nruzcQaEhQYJs59SMx\nvGOGCYikc7OzyeVWpVdZhh/1tUHmJJuw8KnMjDav22dFGjkecSXK3FI0YirpVMI5\nuGEu164LzOuLKTrQvoJXTw==\n-----END PRIVATE KEY-----",
  "client_email": "firebase-adminsdk-fbsvc@managify608.iam.gserviceaccount.com",
  "client_id": "105043392653478418673",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40managify608.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const firestore = admin.firestore();

// Supabase setup
const supabase = createClient(
  'https://eooulfvbllitlhjzilit.supabase.co',
  'sb_secret__dk16inwSwFU45qCE2sMwA_kESOiPAx'
);

async function migrateCollection(fbCollection, sbTable, fieldMap = {}) {
  console.log(`Migrating ${fbCollection} to ${sbTable}...`);
  
  const snapshot = await firestore.collection(fbCollection).get();
  const docs = [];
  
  snapshot.forEach(doc => {
    let data = { id: doc.id, ...doc.data() };
    
    // Map fields
    Object.entries(fieldMap).forEach(([oldField, newField]) => {
      if (data[oldField] !== undefined) {
        data[newField] = data[oldField];
        delete data[oldField];
      }
    });
    
    // Ensure user_id exists
    if (!data.user_id && data.userId) {
      data.user_id = data.userId;
      delete data.userId;
    }
    
    docs.push(data);
  });
  
  if (docs.length === 0) {
    console.log(`No data found in ${fbCollection}`);
    return;
  }
  
  // Insert in batches
  for (let i = 0; i < docs.length; i += 50) {
    const batch = docs.slice(i, i + 50);
    const { error } = await supabase.from(sbTable).insert(batch);
    
    if (error) {
      console.error(`Error inserting ${sbTable}:`, error);
    } else {
      console.log(`Inserted ${batch.length} records into ${sbTable}`);
    }
  }
}

async function migrate() {
  try {
    // Migrate in order (items first due to foreign keys)
    await migrateCollection('items', 'items', {
      createdAt: 'created_at'
    });
    
    await migrateCollection('purchases', 'purchases', {
      itemId: 'item_id',
      costPrice: 'cost_price',
      supplierPhone: 'supplier_phone'
    });
    
    await migrateCollection('sales', 'sales', {
      itemId: 'item_id',
      actualPrice: 'actual_price',
      originalPrice: 'original_price',
      itemDiscount: 'item_discount',
      billDiscount: 'bill_discount',
      customerName: 'customer_name',
      customerPhone: 'customer_phone',
      invoiceNo: 'invoice_no'
    });
    
    await migrateCollection('storeInfo', 'store_info', {
      storeName: 'store_name',
      taxNumber: 'tax_number'
    });
    
    await migrateCollection('expenses', 'expenses');
    
    await migrateCollection('employees', 'employees', {
      firstMonthPay: 'first_month_pay',
      joinDate: 'join_date'
    });
    
    await migrateCollection('invoices', 'invoices', {
      invoiceNo: 'invoice_no',
      billDiscount: 'bill_discount',
      createdAt: 'created_at'
    });
    
    await migrateCollection('suppliers', 'suppliers', {
      supplierId: 'supplier_id',
      createdAt: 'created_at'
    });
    
    console.log('✅ Migration completed!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

migrate();