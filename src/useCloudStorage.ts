import { useAuth } from './auth/useAuth';
import * as cloudStorage from './cloudStorage';

export const useCloudStorage = () => {
  const { user } = useAuth();
  
  if (!user) {
    throw new Error('User must be authenticated to use cloud storage');
  }

  const userId = user.uid;

  return {
    // Items
    listItems: () => cloudStorage.listItems(userId),
    addItem: (item: Omit<cloudStorage.Item, 'id' | 'userId'>) => cloudStorage.addItem(userId, item),
    updateItem: cloudStorage.updateItem,
    deleteItem: cloudStorage.deleteItem,

    // Purchases
    listPurchases: () => cloudStorage.listPurchases(userId),
    addPurchase: (purchase: Omit<cloudStorage.Purchase, 'id' | 'userId'>) => cloudStorage.addPurchase(userId, purchase),

    // Sales
    listSales: () => cloudStorage.listSales(userId),
    addSale: (sale: Omit<cloudStorage.Sale, 'id' | 'userId'>) => cloudStorage.addSale(userId, sale),

    // Store Info
    getStoreInfo: () => cloudStorage.getStoreInfo(userId),
    updateStoreInfo: (info: Omit<cloudStorage.StoreInfo, 'userId'>) => cloudStorage.updateStoreInfo(userId, info),

    // Inventory
    inventory: () => cloudStorage.getInventory(userId),
  };
};