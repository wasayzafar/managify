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

async function migrateEmployees() {
  console.log('Migrating employees...');
  
  const snapshot = await firestore.collection('employees').get();
  const employeesData = [];
  
  snapshot.forEach(doc => {
    const data = doc.data();
    employeesData.push({
      name: data.name,
      salary: data.salary,
      first_month_pay: data.firstMonthPay,
      phone: data.phone,
      address: data.address || '',
      email: data.email || '',
      position: data.position || '',
      join_date: data.joinDate,
      user_id: data.userId
    });
  });
  
  if (employeesData.length > 0) {
    const { error } = await supabase.from('employees').insert(employeesData);
    if (error) {
      console.error('Error:', error);
    } else {
      console.log(`✅ Migrated ${employeesData.length} employees`);
    }
  }
  
  console.log(`🎉 Complete: ${employeesData.length} employees migrated`);
}

migrateEmployees().then(() => process.exit(0));