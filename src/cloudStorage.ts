import { 
  collection, 
  doc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query,
  where,
  orderBy
} from 'firebase/firestore';
import { firestore } from './firebase';

export interface Item {
  id: string;
  sku: string;
  name: string;
  price: number;
  userId: string;
  createdAt?: string;
}

export interface Purchase {
  id: string;
  itemId: string;
  quantity: number;
  date: string;
  userId: string;
  costPrice?: number;
  supplier?: string;
  supplierPhone?: string;
  note?: string;
}

export interface Sale {
  id: string;
  itemId: string;
  quantity: number;
  date: string;
  userId: string;
  actualPrice?: number;
  originalPrice?: number;
  itemDiscount?: number;
  billDiscount?: number;
  customerName?: string;
  customerPhone?: string;
  invoiceNo?: string;
  storeInfo?: {
    storeName: string;
    phone: string;
    address: string;
    email?: string;
    website?: string;
    taxNumber?: string;
    logo?: string;
  };
}

export interface StoreInfo {
  storeName: string;
  phone: string;
  address: string;
  email: string;
  website: string;
  taxNumber: string;
  logo: string;
  userId: string;
}

export interface Expense {
  id: string;
  type: string;
  amount: number;
  description?: string;
  date: string;
  userId: string;
}

export interface Employee {
  id: string;
  name: string;
  salary: number;
  firstMonthPay: number;
  phone: string;
  address: string;
  email?: string;
  position?: string;
  joinDate: string;
  userId: string;
}

export interface Invoice {
  id: string;
  invoiceNo: string;
  customer: string;
  phone?: string;
  lines: any[];
  total: number;
  billDiscount: number;
  createdAt: string;
  date: string;
  userId: string;
  storeInfo?: {
    storeName: string;
    phone: string;
    address: string;
    email?: string;
    website?: string;
    taxNumber?: string;
    logo?: string;
  };
}

export interface Supplier {
  id: string;
  supplierId: string;
  name: string;
  phone: string;
  address: string;
  createdAt?: string;
  userId: string;
}

// Items
export const listItems = async (userId: string): Promise<Item[]> => {
  const q = query(collection(firestore, 'items'), where('userId', '==', userId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Item));
};

export const addItem = async (userId: string, item: Omit<Item, 'id' | 'userId'>): Promise<string> => {
  const docRef = await addDoc(collection(firestore, 'items'), { 
    ...item, 
    userId,
    createdAt: new Date().toISOString()
  });
  return docRef.id;
};

export const updateItem = async (id: string, item: Partial<Omit<Item, 'id' | 'userId'>>): Promise<void> => {
  await updateDoc(doc(firestore, 'items', id), item);
};

export const deleteItem = async (id: string): Promise<void> => {
  await deleteDoc(doc(firestore, 'items', id));
};

// Purchases
export const listPurchases = async (userId: string): Promise<Purchase[]> => {
  const q = query(collection(firestore, 'purchases'), where('userId', '==', userId), orderBy('date', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Purchase));
};

export const addPurchase = async (userId: string, purchase: Omit<Purchase, 'id' | 'userId'>): Promise<string> => {
  const docRef = await addDoc(collection(firestore, 'purchases'), { ...purchase, userId });
  return docRef.id;
};

export const updatePurchase = async (id: string, purchase: Partial<Omit<Purchase, 'id' | 'userId'>>): Promise<void> => {
  await updateDoc(doc(firestore, 'purchases', id), purchase);
};

// Sales
export const listSales = async (userId: string): Promise<Sale[]> => {
  const q = query(collection(firestore, 'sales'), where('userId', '==', userId), orderBy('date', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale));
};

export const listSalesByDateRange = async (userId: string, startDate: string, endDate: string): Promise<Sale[]> => {
  const q = query(
    collection(firestore, 'sales'), 
    where('userId', '==', userId),
    where('date', '>=', startDate),
    where('date', '<=', endDate),
    orderBy('date', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale));
};

export const listSalesByDate = async (userId: string, date: string): Promise<Sale[]> => {
  const startOfDay = date + 'T00:00:00.000Z';
  const endOfDay = date + 'T23:59:59.999Z';
  return listSalesByDateRange(userId, startOfDay, endOfDay);
};

export const addSale = async (userId: string, sale: Omit<Sale, 'id' | 'userId'>): Promise<string> => {
  const docRef = await addDoc(collection(firestore, 'sales'), { ...sale, userId });
  return docRef.id;
};

export const deleteSale = async (id: string): Promise<void> => {
  await deleteDoc(doc(firestore, 'sales', id));
};

// Store Info
export const getStoreInfo = async (userId: string): Promise<StoreInfo> => {
  const q = query(collection(firestore, 'storeInfo'), where('userId', '==', userId));
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) {
    const defaultInfo: StoreInfo = {
      storeName: 'Managify',
      phone: '',
      address: '',
      email: '',
      website: '',
      taxNumber: '',
      logo: '',
      userId
    };
    await addDoc(collection(firestore, 'storeInfo'), defaultInfo);
    return defaultInfo;
  }
  
  return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as StoreInfo;
};

export const updateStoreInfo = async (userId: string, info: Omit<StoreInfo, 'userId'>): Promise<void> => {
  const q = query(collection(firestore, 'storeInfo'), where('userId', '==', userId));
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) {
    await addDoc(collection(firestore, 'storeInfo'), { ...info, userId });
  } else {
    await updateDoc(snapshot.docs[0].ref, info);
  }
};

// Expenses
export const listExpenses = async (userId: string): Promise<Expense[]> => {
  try {
    const q = query(collection(firestore, 'expenses'), where('userId', '==', userId), orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));
  } catch (error) {
    console.error('Error in listExpenses:', error);
    const q = query(collection(firestore, 'expenses'), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));
  }
};

export const addExpense = async (userId: string, expense: Omit<Expense, 'id' | 'userId'>): Promise<string> => {
  const docRef = await addDoc(collection(firestore, 'expenses'), { ...expense, userId });
  return docRef.id;
};

export const updateExpense = async (id: string, expense: Partial<Omit<Expense, 'id' | 'userId'>>): Promise<void> => {
  await updateDoc(doc(firestore, 'expenses', id), expense);
};

export const deleteExpense = async (id: string): Promise<void> => {
  await deleteDoc(doc(firestore, 'expenses', id));
};

// Employees
export const listEmployees = async (userId: string): Promise<Employee[]> => {
  const q = query(collection(firestore, 'employees'), where('userId', '==', userId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
};

export const addEmployee = async (userId: string, employee: Omit<Employee, 'id' | 'userId'>): Promise<string> => {
  const docRef = await addDoc(collection(firestore, 'employees'), { ...employee, userId });
  return docRef.id;
};

export const updateEmployee = async (id: string, employee: Partial<Omit<Employee, 'id' | 'userId'>>): Promise<void> => {
  await updateDoc(doc(firestore, 'employees', id), employee);
};

export const deleteEmployee = async (id: string): Promise<void> => {
  await deleteDoc(doc(firestore, 'employees', id));
};

// Invoices
export const listInvoices = async (userId: string): Promise<Invoice[]> => {
  const q = query(collection(firestore, 'invoices'), where('userId', '==', userId), orderBy('date', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invoice));
};

export const addInvoice = async (userId: string, invoice: Omit<Invoice, 'id' | 'userId'>): Promise<string> => {
  const docRef = await addDoc(collection(firestore, 'invoices'), { ...invoice, userId });
  return docRef.id;
};

// Suppliers
export const listSuppliers = async (userId: string): Promise<Supplier[]> => {
  const q = query(collection(firestore, 'suppliers'), where('userId', '==', userId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier));
};

export const addSupplier = async (userId: string, supplier: Omit<Supplier, 'id' | 'userId'>): Promise<string> => {
  const docRef = await addDoc(collection(firestore, 'suppliers'), { ...supplier, userId });
  return docRef.id;
};

export const updateSupplier = async (id: string, supplier: Partial<Omit<Supplier, 'id' | 'userId'>>): Promise<void> => {
  await updateDoc(doc(firestore, 'suppliers', id), supplier);
};

export const deleteSupplier = async (id: string): Promise<void> => {
  await deleteDoc(doc(firestore, 'suppliers', id));
};

// Clear all user data
export const clearAllData = async (userId: string): Promise<void> => {
  const collections = ['items', 'purchases', 'sales', 'storeInfo', 'expenses', 'employees', 'invoices', 'suppliers'];
  
  for (const collectionName of collections) {
    const q = query(collection(firestore, collectionName), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    
    const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
  }
};

// Inventory calculation
export const getInventory = async (userId: string): Promise<Array<{ itemId: string; itemName: string; itemSku: string; stock: number }>> => {
  const [items, purchases, sales] = await Promise.all([
    listItems(userId),
    listPurchases(userId),
    listSales(userId)
  ]);

  return items.map(item => {
    const totalPurchased = purchases
      .filter(p => p.itemId === item.id)
      .reduce((sum, p) => sum + p.quantity, 0);
    
    const totalSold = sales
      .filter(s => s.itemId === item.id)
      .reduce((sum, s) => sum + s.quantity, 0);

    return {
      itemId: item.id,
      itemName: item.name,
      itemSku: item.sku,
      stock: totalPurchased - totalSold
    };
  });
};