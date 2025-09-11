import { addDoc, collection } from 'firebase/firestore';
import { firestore } from './firebase';

export const createTestData = async (userId: string) => {
  try {
    // Create test item
    const itemRef = await addDoc(collection(firestore, 'items'), {
      sku: 'TEST001',
      name: 'Test Item',
      price: 100,
      userId
    });

    // Create test purchase
    await addDoc(collection(firestore, 'purchases'), {
      itemId: itemRef.id,
      quantity: 10,
      date: new Date().toISOString(),
      userId
    });

    // Create test sale
    await addDoc(collection(firestore, 'sales'), {
      itemId: itemRef.id,
      quantity: 2,
      date: new Date().toISOString(),
      userId
    });

    // Create store info
    await addDoc(collection(firestore, 'storeInfo'), {
      storeName: 'Managify',
      phone: '',
      address: '',
      email: '',
      website: '',
      taxNumber: '',
      logo: '',
      userId
    });

    console.log('Test data created successfully!');
  } catch (error) {
    console.error('Error creating test data:', error);
  }
};