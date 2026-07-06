import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  updateDoc,
  query,
  writeBatch,
  WriteBatch,
  onSnapshot,
  runTransaction,
  Unsubscribe,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { db, storage } from "./firebase";
import { encryptDoc, decryptDoc } from "./crypto";
import {
  CompanyProfile,
  Client,
  Product,
  Bill,
  BillItem,
  InventoryTransaction,
  PurchaseBill,
  BillReturn,
  DeadstockItem,
  Expense,
  UploadedFile,
  Note,
  InventoryAddResult,
  ProductConflict,
  SampleBill,
  PaymentMethod,
  PaymentTransaction,
  PurchaseReturn,
  PurchaseReturnItem,
  BankAccount,
  Vendor,
  Expo,
  InventoryUnit,
  PartyPayment,
} from "@/types";

// Collection names
const COLLECTIONS = {
  COMPANY: "company",
  CLIENTS: "clients",
  PRODUCTS: "products",
  BILLS: "bills",
  INVENTORY: "inventory",
  INVENTORY_UNITS: "inventoryUnits",
  BILL_COUNTER: "counters",
  PURCHASE_BILLS: "purchaseBills",
  BILL_RETURNS: "billReturns",
  DEADSTOCK: "deadstock",
  USER_PREFERENCES: "userPreferences",
  EXPENSES: "expenses",
  FILES: "files",
  NOTES: "notes",
  SAMPLE_BILLS: "sampleBills",
  CUSTOMERS: "customers",
  COUNTERS: "counters",
  PURCHASE_RETURNS: "purchaseReturns",
  CREATORS: "creators",
  BANK_ACCOUNTS: "bankAccounts",
  VENDORS: "vendors",
  EXPOS: "expos",
  PARTY_PAYMENTS: "partyPayments",
  KEY_RECOVERY: "keyRecovery",
  ENC_META: "encMeta",
};

// Helper function to get user ID (for multi-user support in future)
const getUserId = (): string => {
  // For now, using a default user ID. In future, this can be from auth.currentUser
  return "default";
};

// Helper function to remove undefined values from objects (Firestore doesn't support undefined)
const removeUndefined = (obj: any): any => {
  if (obj === null || obj === undefined) {
    return null;
  }
  if (Array.isArray(obj)) {
    return obj.map(removeUndefined);
  }
  if (typeof obj === "object") {
    const cleaned: any = {};
    for (const key in obj) {
      if (obj[key] !== undefined) {
        cleaned[key] = removeUndefined(obj[key]);
      }
    }
    return cleaned;
  }
  return obj;
};

const roundToTwo = (value: number): number => Math.round(value * 100) / 100;

// Creators
export const getCreators = async (): Promise<any[]> => {
  try {
    const userId = getUserId();
    const q = query(
      collection(db, COLLECTIONS.CREATORS)
    );
    const querySnapshot = await getDocs(q);
    return await Promise.all(querySnapshot.docs.map(async (doc) => ({
      id: doc.id,
      ...(await decryptDoc(doc.data() as any)),
    })));
  } catch (error: any) {
    console.error("Error getting creators:", error);
    return [];
  }
};

export const saveCreator = async (creator: any): Promise<void> => {
  try {
    const userId = getUserId();
    const docRef = doc(db, COLLECTIONS.CREATORS, creator.id);
    await setDoc(docRef, await encryptDoc(removeUndefined({ ...creator, userId })));
  } catch (error) {
    console.error("Error saving creator:", error);
    throw error;
  }
};

export const deleteCreator = async (id: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTIONS.CREATORS, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting creator:", error);
    throw error;
  }
};

// Bank Accounts
export const getBankAccounts = async (): Promise<BankAccount[]> => {
  try {
    const userId = getUserId();
    const q = query(
      collection(db, COLLECTIONS.BANK_ACCOUNTS)
    );
    const querySnapshot = await getDocs(q);
    return await Promise.all(querySnapshot.docs.map(async (doc) => ({
      id: doc.id,
      ...(await decryptDoc(doc.data() as any)),
    }))) as BankAccount[];
  } catch (error: any) {
    console.error("Error getting bank accounts:", error);
    return [];
  }
};

export const saveBankAccount = async (account: BankAccount): Promise<void> => {
  try {
    const userId = getUserId();
    const docRef = doc(db, COLLECTIONS.BANK_ACCOUNTS, account.id);
    await setDoc(docRef, await encryptDoc(removeUndefined({ ...account, userId })));
  } catch (error) {
    console.error("Error saving bank account:", error);
    throw error;
  }
};

export const deleteBankAccount = async (id: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTIONS.BANK_ACCOUNTS, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting bank account:", error);
    throw error;
  }
};

// Vendors
export const getVendors = async (): Promise<Vendor[]> => {
  try {
    const userId = getUserId();
    const q = query(
      collection(db, COLLECTIONS.VENDORS)
    );
    const querySnapshot = await getDocs(q);
    return await Promise.all(querySnapshot.docs.map(async (doc) => ({
      id: doc.id,
      ...(await decryptDoc(doc.data() as any)),
    }))) as Vendor[];
  } catch (error: any) {
    console.error("Error getting vendors:", error);
    return [];
  }
};

export const saveVendor = async (vendor: Vendor): Promise<void> => {
  try {
    const userId = getUserId();
    const docRef = doc(db, COLLECTIONS.VENDORS, vendor.id);
    await setDoc(docRef, await encryptDoc(removeUndefined({ ...vendor, userId })));
  } catch (error) {
    console.error("Error saving vendor:", error);
    throw error;
  }
};

export const deleteVendor = async (id: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTIONS.VENDORS, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting vendor:", error);
    throw error;
  }
};

// Expos
export const getExpos = async (): Promise<Expo[]> => {
  try {
    const userId = getUserId();
    const q = query(
      collection(db, COLLECTIONS.EXPOS)
    );
    const querySnapshot = await getDocs(q);
    return await Promise.all(querySnapshot.docs.map(async (doc) => ({
      id: doc.id,
      ...(await decryptDoc(doc.data() as any)),
    }))) as Expo[];
  } catch (error: any) {
    console.error("Error getting expos:", error);
    return [];
  }
};

export const saveExpo = async (expo: Expo): Promise<void> => {
  try {
    const userId = getUserId();
    const docRef = doc(db, COLLECTIONS.EXPOS, expo.id);
    await setDoc(docRef, await encryptDoc(removeUndefined({ ...expo, userId })));
  } catch (error) {
    console.error("Error saving expo:", error);
    throw error;
  }
};

export const deleteExpo = async (id: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTIONS.EXPOS, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting expo:", error);
    throw error;
  }
};

export const transferStockToExpo = async (
  expoId: string,
  productId: string,
  quantity: number
): Promise<void> => {
  try {
    const batch = writeBatch(db);
    const productRef = doc(db, COLLECTIONS.PRODUCTS, productId);
    const expoRef = doc(db, COLLECTIONS.EXPOS, expoId);

    const [productSnap, expoSnap] = await Promise.all([
      getDoc(productRef),
      getDoc(expoRef),
    ]);

    if (!productSnap.exists() || !expoSnap.exists()) {
      throw new Error("Product or Expo not found");
    }

    const product = await decryptDoc(productSnap.data() as any) as Product;
    const expo = await decryptDoc(expoSnap.data() as any) as Expo;

    if (product.stock < quantity) {
      throw new Error(`Insufficient stock for ${product.name}`);
    }

    // Update product main stock and expo-specific stock
    const newMainStock = product.stock - quantity;
    const currentExpoStock = product.expoStocks?.[expoId] || 0;
    const newExpoStock = currentExpoStock + quantity;

    const updatedExpoStocks = { ...(product.expoStocks || {}), [expoId]: newExpoStock };
    batch.set(productRef, await encryptDoc(removeUndefined({ ...product, stock: newMainStock, expoStocks: updatedExpoStocks })));

    // Update expo tracking
    const initialStocks = { ...expo.initialStocks };
    initialStocks[productId] = (initialStocks[productId] || 0) + quantity;
    const remainingStocks = { ...expo.remainingStocks };
    remainingStocks[productId] = (remainingStocks[productId] || 0) + quantity;

    batch.set(expoRef, await encryptDoc(removeUndefined({ ...expo, initialStocks, remainingStocks })));

    await batch.commit();
  } catch (error) {
    console.error("Error transferring stock to expo:", error);
    throw error;
  }
};

export const endExpoAndReturnStock = async (expoId: string): Promise<void> => {
  try {
    const batch = writeBatch(db);
    const expoRef = doc(db, COLLECTIONS.EXPOS, expoId);
    const expoSnap = await getDoc(expoRef);

    if (!expoSnap.exists()) throw new Error("Expo not found");
    const expo = await decryptDoc(expoSnap.data() as any) as Expo;

    // Return remaining stocks to main inventory
    for (const [productId, quantity] of Object.entries(expo.remainingStocks)) {
      const qty = Number(quantity);
      if (qty > 0) {
        const productRef = doc(db, COLLECTIONS.PRODUCTS, productId);
        const productSnap = await getDoc(productRef);
        if (productSnap.exists()) {
          const product = await decryptDoc(productSnap.data() as any) as Product;
          const updatedExpoStocks = { ...(product.expoStocks || {}), [expoId]: 0 };
          batch.set(productRef, await encryptDoc(removeUndefined({ ...product, stock: (Number(product.stock) || 0) + qty, expoStocks: updatedExpoStocks })));
        }
      }
    }

    batch.set(expoRef, await encryptDoc(removeUndefined({ ...expo, status: "completed" })));
    await batch.commit();
  } catch (error) {
    console.error("Error ending expo:", error);
    throw error;
  }
};

// Company Profile
/** Check if any plain-text (unencrypted) data exists in Firestore. */
export const hasUnencryptedData = async (): Promise<boolean> => {
  try {
    const userId = getUserId();
    const snap = await getDoc(doc(db, COLLECTIONS.COMPANY, userId));
    if (!snap.exists()) return false;
    return !snap.data()?._e; // plain text if no _e field
  } catch {
    return false;
  }
};

/**
 * Store the admin-encrypted recovery blob in a dedicated Firestore collection.
 * Stored separately so it is never overwritten by normal profile saves.
 * The blob itself is encrypted with the admin master key — safe to store in plain text.
 */
export const saveKeyRecoveryBlob = async (blob: string): Promise<void> => {
  const userId = getUserId();
  await setDoc(doc(db, COLLECTIONS.KEY_RECOVERY, userId), { blob, savedAt: Date.now() });
};

/** Fetch the admin-encrypted recovery blob. Returns null if none exists. */
export const getKeyRecoveryBlob = async (): Promise<string | null> => {
  try {
    const userId = getUserId();
    const snap = await getDoc(doc(db, COLLECTIONS.KEY_RECOVERY, userId));
    if (!snap.exists()) return null;
    return (snap.data()?.blob as string) ?? null;
  } catch {
    return null;
  }
};

/** Raw existence check — does NOT decrypt. Used to guard against overwriting an existing profile with blank data (e.g. when the fetch/decrypt failed and the UI fell back to defaults). */
export const companyProfileExists = async (): Promise<boolean> => {
  try {
    const userId = getUserId();
    const snap = await getDoc(doc(db, COLLECTIONS.COMPANY, userId));
    return snap.exists();
  } catch {
    return false;
  }
};

export const getCompanyProfile = async (): Promise<CompanyProfile | null> => {
  try {
    const userId = getUserId();
    const docRef = doc(db, COLLECTIONS.COMPANY, userId);
    // Use getDoc with no source option to allow offline cache fallback
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return await decryptDoc(docSnap.data() as any) as CompanyProfile;
    }
    return null;
  } catch (error: any) {
    // If the error is due to being offline, try to return from cache if possible
    // Firestore SDK usually does this automatically if persistence is enabled
    console.error("Error getting company profile:", error);
    return null;
  }
};

export const saveCompanyProfile = async (
  profile: CompanyProfile
): Promise<void> => {
  try {
    const userId = getUserId();
    const docRef = doc(db, COLLECTIONS.COMPANY, userId);
    // Preserve the most-recent snCounter — incrementSnCounter writes it at root
    // (QUERY_FIELDS) but the in-memory profile.snCounter may be stale (decrypted
    // from _e before the last increment). Only skip the max when explicitly
    // resetting to 0 (Settings prefix-change reset).
    let mergedProfile = { ...profile };
    if (Number(profile.snCounter || 0) !== 0) {
      const existing = await getDoc(docRef);
      const rootSnCounter = existing.exists() ? (Number((existing.data() as any)?.snCounter) || 0) : 0;
      mergedProfile = { ...profile, snCounter: Math.max(Number(profile.snCounter || 0), rootSnCounter) };
    }
    const cleanedData = removeUndefined(mergedProfile);
    await setDoc(docRef, await encryptDoc(cleanedData));
  } catch (error) {
    console.error("Error saving company profile:", error);
    throw error;
  }
};

// H5: Atomically reserve `count` SN numbers. Returns the first number to use
// (i.e. caller uses [result, result+1, ..., result+count-1]).
// Uses a Firestore transaction so two sessions can never get the same range.
// minCurrent: optional floor derived from scanning existing bills — prevents going
// backwards if the Firestore counter is stale or was wiped by a profile save.
export const incrementSnCounter = async (count: number, minCurrent = 0): Promise<number> => {
  if (count <= 0) return 0;
  const userId = getUserId();
  const docRef = doc(db, COLLECTIONS.COMPANY, userId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(docRef);
    const rawData = snap.exists() ? (snap.data() as any) : {};
    // Root-level snCounter is preserved by encryptDoc (snCounter is in QUERY_FIELDS).
    // For older encrypted docs that don't have it at root yet, decrypt to read it.
    let current = Number(rawData.snCounter || 0);
    if (current === 0 && rawData._e) {
      try {
        const decrypted = await decryptDoc(rawData);
        current = Number(decrypted.snCounter || 0);
      } catch { /* ignore — use 0 */ }
    }
    // Apply floor from caller's bill-scan ground-truth to handle stale counters
    if (minCurrent > current) current = minCurrent;
    const next = current + count;
    tx.update(docRef, { snCounter: next });
    return current + 1;
  });
};

// Clients
export const getClients = async (): Promise<Client[]> => {
  try {
    const userId = getUserId();
    const q = query(
      collection(db, COLLECTIONS.CLIENTS)
    );
    const querySnapshot = await getDocs(q);

    const clients = await Promise.all(querySnapshot.docs.map(async (doc) => {
      const data = await decryptDoc(doc.data() as any);
      return {
        ...data,
        billingAddress: data.billingAddress || data.address || "",
        shippingAddress: data.shippingAddress || "",
        gstin: data.gstin || data.gstNo || "",
      } as Client;
    }));

    // Sort by createdAt descending in JavaScript (avoids index requirement)
    return clients.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });
  } catch (error: any) {
    console.error("Error getting clients:", error);
    return [];
  }
};

export const saveClient = async (client: Client): Promise<void> => {
  try {
    const userId = getUserId();
    const docRef = doc(db, COLLECTIONS.CLIENTS, client.id);
    const cleanedData = removeUndefined({ ...client, userId });
    await setDoc(docRef, await encryptDoc(cleanedData));
  } catch (error) {
    console.error("Error saving client:", error);
    throw error;
  }
};

export const deleteClient = async (id: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTIONS.CLIENTS, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting client:", error);
    throw error;
  }
};

// Products
export const getProducts = async (): Promise<Product[]> => {
  try {
    const userId = getUserId();
    const q = query(
      collection(db, COLLECTIONS.PRODUCTS)
    );
    const querySnapshot = await getDocs(q);

    const products = await Promise.all(querySnapshot.docs.map(async (doc) => {
      const data = await decryptDoc(doc.data() as any);
      const trackingType =
        data.trackingType ||
        ((data.imeiNumber || "").toString().trim() ? "serialized" : "standard");
      const sellingPrice =
        trackingType === "serialized"
          ? data.sellingPrice || 0
          : data.sellingPrice || data.price || 0;
      return {
        ...data,
        purchasePrice: data.purchasePrice || 0,
        sellingPrice,
        trackingType,
        weight: typeof data.weight === "string" ? parseFloat(data.weight) || 0 : (data.weight || 0),
        weightUnit: (data.weightUnit as string) || (data.unit === "kg" ? "kg" : "g"),
        vendorId: data.vendorId || "",
      } as Product;
    }));

    // Sort by createdAt descending in JavaScript (avoids index requirement)
    return products.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });
  } catch (error: any) {
    console.error("Error getting products:", error);
    return [];
  }
};

export const saveProduct = async (product: Product): Promise<void> => {
  try {
    const userId = getUserId();
    const docRef = doc(db, COLLECTIONS.PRODUCTS, product.id);
    const cleanedData = removeUndefined({ ...product, userId });
    await setDoc(docRef, await encryptDoc(cleanedData));
  } catch (error) {
    console.error("Error saving product:", error);
    throw error;
  }
};

export const deleteProduct = async (id: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTIONS.PRODUCTS, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting product:", error);
    throw error;
  }
};

export const updateProductStock = async (
  productId: string,
  quantity: number,
  type: "sale" | "return"
): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTIONS.PRODUCTS, productId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const product = await decryptDoc(docSnap.data() as any) as Product;
      let newStock: number;

      if (type === "sale") {
        newStock = Math.max(0, product.stock - quantity);
      } else {
        newStock = product.stock + quantity;
      }

      // Round to 2 decimal places
      newStock = Math.round(newStock * 100) / 100;

      await setDoc(docRef, await encryptDoc(removeUndefined({ ...product, stock: newStock })));
    }
  } catch (error) {
    console.error("Error updating product stock:", error);
    throw error;
  }
};

// Bills
export const getBills = async (): Promise<Bill[]> => {
  try {
    const userId = getUserId();
    const q = query(
      collection(db, COLLECTIONS.BILLS)
    );
    const [querySnapshot, clients] = await Promise.all([getDocs(q), getClients()]);
    const clientMap = new Map(clients.map((client) => [client.id, client]));

    const bills = await Promise.all(querySnapshot.docs.map(async (doc) => {
      const data = await decryptDoc(doc.data() as any);
      const client = data.client || {};
      const latestClient = clientMap.get(data.clientId);
      return {
        ...data,
        client: {
          ...client,
          id: client.id || latestClient?.id || data.clientId || "",
          name: client.name || latestClient?.name || "",
          phone: client.phone || latestClient?.phone || "",
          billingAddress:
            client.billingAddress || client.address || latestClient?.billingAddress || "",
          shippingAddress: client.shippingAddress || latestClient?.shippingAddress || "",
          gstin: latestClient?.gstin || client.gstin || client.gstNo || "",
        },
      } as Bill;
    }));

    // Sort by createdAt descending in JavaScript (avoids index requirement)
    return bills.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });
  } catch (error: any) {
    console.error("Error getting bills:", error);
    return [];
  }
};

export const saveBill = async (bill: Bill): Promise<void> => {
  try {
    const userId = getUserId();
    const batch = writeBatch(db);
    const now = new Date().toISOString();

    // Check if this is an update by trying to fetch the existing bill
    const billRef = doc(db, COLLECTIONS.BILLS, bill.id);
    const existingBillSnap = await getDoc(billRef);
    const isUpdate = existingBillSnap.exists();

    let existingBill: Bill | null = null;
    if (isUpdate) {
      existingBill = await decryptDoc(existingBillSnap.data() as any) as Bill;
    }

    // Calculate stock adjustments needed
    const stockAdjustments = new Map<string, number>();

    if (isUpdate && existingBill) {
      // For updates, calculate the difference between old and new quantities

      // First, restore stock from original items
      for (const oldItem of existingBill.items) {
        const currentAdjustment = stockAdjustments.get(oldItem.productId) || 0;
        stockAdjustments.set(
          oldItem.productId,
          currentAdjustment + oldItem.quantity
        );
      }

      // Then, deduct stock for new items
      for (const newItem of bill.items) {
        const currentAdjustment = stockAdjustments.get(newItem.productId) || 0;
        stockAdjustments.set(
          newItem.productId,
          currentAdjustment - newItem.quantity
        );
      }
    } else {
      // For new bills, deduct full quantities
      for (const item of bill.items) {
        const currentAdjustment = stockAdjustments.get(item.productId) || 0;
        stockAdjustments.set(item.productId, currentAdjustment - item.quantity);
      }
    }

    // Validate stock availability for all adjustments
    for (const [productId, adjustment] of stockAdjustments.entries()) {
      if (adjustment < 0) {
        // Only validate if we need to deduct stock (negative adjustment)
        const productRef = doc(db, COLLECTIONS.PRODUCTS, productId);
        const productSnap = await getDoc(productRef);

        if (productSnap.exists()) {
          const product = await decryptDoc(productSnap.data() as any) as Product;
          const requiredStock = Math.abs(adjustment);
          const isSerializedProduct =
            (product.trackingType || "standard") === "serialized";
          const availableStock = isSerializedProduct
            ? (await getAvailableInventoryUnits(productId)).length
            : product.stock || 0;

          if (availableStock < requiredStock) {
            const productName =
              bill.items.find((i) => i.productId === productId)?.productName ||
              "Unknown";
            throw new Error(
              `Insufficient stock for ${productName}. Available: ${availableStock.toFixed(
                2
              )}, Required: ${requiredStock.toFixed(2)}`
            );
          }
        } else {
          throw new Error(`Product not found: ${productId}`);
        }
      }
    }

    const allProducts = await getProducts();
    const productMap = new Map(allProducts.map((p) => [p.id, p]));
    const isSerializedBillItem = (item: BillItem) =>
      (productMap.get(item.productId)?.trackingType || "standard") ===
      "serialized";

    const serializedItems = bill.items.filter((item) =>
      isSerializedBillItem(item),
    );
    for (const item of serializedItems) {
      const hasImei = Boolean(normalizeImeiText(item.imeiNumber));
      const hasUnitId = Boolean(item.inventoryUnitId);
      if (!hasImei && !hasUnitId) {
        throw new Error(
          `Serialized item "${item.productName}" requires IMEI/Serial selection.`,
        );
      }
      if (item.quantity !== 1) {
        throw new Error(
          `Serialized item "${item.productName}" must have quantity 1.`,
        );
      }
    }

    const imeiItems = bill.items.filter(
      (item) =>
        isSerializedBillItem(item) ||
        Boolean(normalizeImeiText(item.imeiNumber)) ||
        Boolean(item.inventoryUnitId),
    );
    const seenImeis = new Set<string>();
    for (const item of imeiItems) {
      const imei = normalizeImeiText(item.imeiNumber);
      if (imei && seenImeis.has(imei)) {
        throw new Error(`Duplicate IMEI in bill: ${item.imeiNumber}`);
      }
      if (imei) {
        seenImeis.add(imei);
      }
      if (isSerializedBillItem(item) && item.quantity !== 1) {
        throw new Error(
          `IMEI item "${item.productName}" must have quantity 1.`,
        );
      }
    }

    const inventoryUnits = await getInventoryUnits();
    const soldByThisBill = inventoryUnits.filter((u) => u.soldBillId === bill.id);
    const requiredImeis = new Set(
      imeiItems
        .map((i) => normalizeImeiText(i.imeiNumber))
        .filter(Boolean),
    );
    const requiredUnitIds = new Set(
      imeiItems.map((i) => i.inventoryUnitId).filter(Boolean),
    );

    if (isUpdate) {
      for (const unit of soldByThisBill) {
        const unitImei = normalizeImeiText(unit.imeiNormalized || unit.imeiNumber);
        if (!requiredImeis.has(unitImei) && !requiredUnitIds.has(unit.id)) {
          const unitRef = doc(db, COLLECTIONS.INVENTORY_UNITS, unit.id);
          batch.set(unitRef, await encryptDoc(removeUndefined({ ...unit, status: "in_stock", soldBillId: null, soldAt: null, updatedAt: now })));
        }
      }
    }

    for (const item of imeiItems) {
      const imei = normalizeImeiText(item.imeiNumber);
      const candidate =
        inventoryUnits.find(
          (u) =>
            Boolean(item.inventoryUnitId) &&
            u.id === item.inventoryUnitId &&
            u.productId === item.productId &&
            (u.status === "in_stock" || u.soldBillId === bill.id),
        ) ||
        inventoryUnits.find(
          (u) =>
            Boolean(imei) &&
            normalizeImeiText(u.imeiNormalized || u.imeiNumber) === imei &&
            u.productId === item.productId &&
            (u.status === "in_stock" || u.soldBillId === bill.id),
        );
      if (!candidate) {
        throw new Error(
          `IMEI ${item.imeiNumber} is not available in inventory for ${item.productName}.`,
        );
      }
      item.inventoryUnitId = candidate.id;
      item.imeiNumber = candidate.imeiNumber;
      item.serialNumber = candidate.serialNumber || undefined;
      if (typeof candidate.purchasePrice === "number") {
        item.purchasePrice = candidate.purchasePrice;
      }
      item.amount = roundToTwo(item.quantity * item.ratePerUnit);
      item.gstRate = 0;
      item.igst = 0;
      item.cgst = 0;
      item.sgst = 0;
      const unitRef = doc(db, COLLECTIONS.INVENTORY_UNITS, candidate.id);
      batch.set(unitRef, await encryptDoc(removeUndefined({ ...candidate, status: "sold", soldBillId: bill.id, soldAt: now, updatedAt: now })));
    }

    for (const item of bill.items) {
      const sourceProduct = productMap.get(item.productId);
      if (typeof item.purchasePrice !== "number" || Number.isNaN(item.purchasePrice)) {
        item.purchasePrice = roundToTwo(sourceProduct?.purchasePrice || 0);
      }
      item.amount = roundToTwo(item.quantity * item.ratePerUnit);
      item.gstRate = 0;
      item.igst = 0;
      item.cgst = 0;
      item.sgst = 0;
    }

    const subtotal = roundToTwo(
      bill.items.reduce((sum, item) => sum + (item.amount || 0), 0),
    );
    const courierCharges = roundToTwo(bill.courierCharges || 0);
    const discount = Math.min(roundToTwo(bill.discount || 0), subtotal);
    const subtotalAfterDiscount = roundToTwo(subtotal - discount);

    // Preserve GST tax fields — recalculate from stored rate so data is never lost
    const isGstBill = !!(bill.isGst && (bill.gstRate ?? 0) > 0);
    const cgst = isGstBill ? roundToTwo((subtotalAfterDiscount * bill.gstRate!) / 100 / 2) : 0;
    const sgst = cgst;
    const totalTax = roundToTwo(cgst + sgst);

    const rawTotal = roundToTwo(subtotalAfterDiscount + totalTax + courierCharges);
    // Round off removed per client requirement: total is the exact calculated amount
    const roundedTotal = rawTotal;
    bill.subtotal = subtotal;
    bill.cgst = isGstBill ? cgst : undefined;
    bill.sgst = isGstBill ? sgst : undefined;
    bill.totalTax = isGstBill ? totalTax : undefined;
    bill.discount = discount;
    bill.roundOff = 0;
    bill.total = roundedTotal;

    // Apply stock adjustments
    for (const [productId, adjustment] of stockAdjustments.entries()) {
      if (adjustment !== 0) {
        const productRef = doc(db, COLLECTIONS.PRODUCTS, productId);
        const productSnap = await getDoc(productRef);

        if (productSnap.exists()) {
          const product = await decryptDoc(productSnap.data() as any) as Product;
          const newStock = Math.max(0, product.stock + adjustment); // adjustment is negative for deduction
          batch.set(productRef, await encryptDoc(removeUndefined({ ...product, stock: newStock })));
        }
      }
    }

    // Handle inventory transactions
    if (isUpdate && existingBill) {
      // Delete old inventory transactions for this bill.
      // Encrypted docs store billId inside _e — fetch all and filter in memory.
      const allInvSnap = await getDocs(collection(db, COLLECTIONS.INVENTORY));
      const oldTransactions = await Promise.all(
        allInvSnap.docs.map(async (d) => ({ ref: d.ref, data: await decryptDoc(d.data() as any) }))
      );
      oldTransactions.filter(t => t.data.billId === bill.id).forEach(t => batch.delete(t.ref));

      // Update payment transactions if amount changed
      // Instead of adding new entries, we'll keep the existing ones if possible
      // or just ensure the total paidAmount is correctly reflected.
      // The user wants to update the entry in the passbook, not add another.
      // Since Passbook derives from payments array, we should maintain it.
      if (bill.total !== existingBill.total) {
        // Handle fully paid bills: Adjust the payment to match the new total
        if (existingBill.paymentStatus === 'paid' && (bill.paidAmount === existingBill.total || bill.paidAmount === bill.total)) {
          bill.paidAmount = bill.total;
          bill.paymentStatus = 'paid';
          
          if (bill.payments && bill.payments.length > 0) {
             // If there's only one payment, adjust it directly
             if (bill.payments.length === 1) {
               bill.payments[0].amount = bill.total;
               bill.payments[0].date = new Date().toISOString(); // Update date to reflect change
             } else {
               // If multiple payments, adjust the last one by the difference.
               // Clamp to 0 — never let a payment go negative.
               const diff = bill.total - existingBill.total;
               const last = bill.payments[bill.payments.length - 1];
               last.amount = Math.max(0, last.amount + diff);
               last.date = new Date().toISOString();
               // Recalculate paidAmount and status from the (now corrected) payments array
               bill.paidAmount = bill.payments.reduce((sum: number, p: any) => sum + p.amount, 0);
               bill.paymentStatus =
                 bill.paidAmount > bill.total ? "overpaid" :
                 bill.paidAmount >= bill.total ? "paid" :
                 bill.paidAmount > 0 ? "partial" : "pending";
             }
          } else {
            // C-4: bill was marked paid but has no payments[] entries — create a synthetic one
            bill.payments = [{
              id: crypto.randomUUID(),
              amount: bill.total,
              method: (bill.modeOfPayment as any) || 'Cash',
              date: bill.date || new Date().toISOString(),
            }];
          }
        }
      }
    } else if (!isUpdate && bill.paidAmount > 0) {
      // For new bills with initial payment, ensure it's in the payments array
      if (!bill.payments || bill.payments.length === 0) {
        bill.payments = [{
          id: crypto.randomUUID(),
          amount: bill.paidAmount,
          method: (bill.modeOfPayment as any) || 'Cash',
          date: bill.date || new Date().toISOString(),
        }];
      }
    }

    // Ensure payments array is never null/undefined
    if (!bill.payments) {
      bill.payments = [];
    }

    // Save bill — snapshot taken AFTER all payment mutations so paidAmount and
    // payments[] are finalised before writing to Firestore.
    const cleanedBillData = removeUndefined({ ...bill, userId });
    batch.set(billRef, await encryptDoc(cleanedBillData));

    // Update Expo stats if expoId is present — placed here so it reads the
    // correct post-mutation bill.paidAmount.
    if (bill.expoId) {
      const expoRef = doc(db, COLLECTIONS.EXPOS, bill.expoId);
      const expoSnap = await getDoc(expoRef);
      if (expoSnap.exists()) {
        const expoData = await decryptDoc(expoSnap.data() as any) as Expo;
        const soldStocks = { ...(expoData.soldStocks || {}) };
        const remainingStocks = { ...(expoData.remainingStocks || {}) };

        // On edit: roll back the old bill's contribution first to prevent double-counting
        const sameExpo = isUpdate && existingBill && existingBill.expoId === bill.expoId;
        if (sameExpo && existingBill) {
          for (const item of existingBill.items) {
            soldStocks[item.productId] = Math.max(0, (Number(soldStocks[item.productId]) || 0) - Number(item.quantity));
            remainingStocks[item.productId] = (Number(remainingStocks[item.productId]) || 0) + Number(item.quantity);
          }
        }

        for (const item of bill.items) {
          soldStocks[item.productId] = (Number(soldStocks[item.productId]) || 0) + Number(item.quantity);
          remainingStocks[item.productId] = (Number(remainingStocks[item.productId]) || 0) - Number(item.quantity);
        }

        const oldTotal = sameExpo ? Number(existingBill?.total || 0) : 0;
        const oldPaid = sameExpo ? Number(existingBill?.paidAmount || 0) : 0;

        batch.set(expoRef, await encryptDoc(removeUndefined({
          ...expoData,
          soldStocks,
          remainingStocks,
          totalSales: Math.max(0, (Number(expoData.totalSales) || 0) - oldTotal + Number(bill.total)),
          receivableAmount: Math.max(0, (Number(expoData.receivableAmount) || 0) - (oldTotal - oldPaid) + (Number(bill.total) - Number(bill.paidAmount))),
          receivedAmount: Math.max(0, (Number(expoData.receivedAmount) || 0) - oldPaid + Number(bill.paidAmount)),
        })));
      }
    }

    // Create new inventory transaction records
    for (const item of bill.items) {
      const transactionRef = doc(collection(db, COLLECTIONS.INVENTORY));
      const transaction = {
        id: transactionRef.id,
        productId: item.productId,
        billId: bill.id,
        type: "sale" as const,
        quantity: item.quantity,
        purchasePrice: item.purchasePrice || 0,
        sellingPrice: item.ratePerUnit,
        itemNo: item.itemNo || "",
        model: item.model || "",
        imeiNumber: item.imeiNumber || "",
        storage: item.storage || "",
        color: item.color || "",
        vendorId: item.vendorId || "",
        vendorName: item.vendorName || "",
        clientId: bill.clientId,
        clientName: bill.client?.name || "",
        date: new Date().toISOString(),
        userId,
        inventoryUnitId: item.inventoryUnitId || "",
      };
      batch.set(transactionRef, await encryptDoc(transaction));
    }

    // Auto-sync sales courier charge into Expenses
    const courierExpenseRef = doc(
      db,
      COLLECTIONS.EXPENSES,
      `sale-courier-${bill.id}`,
    );
    const previousCourier = roundToTwo(existingBill?.courierCharges || 0);
    const currentCourier = roundToTwo(bill.courierCharges || 0);
    const paymentSource = (bill.paymentType || bill.modeOfPayment || "").toLowerCase();
    const expensePaymentMethod: Expense["paymentMethod"] =
      bill.bankAccountId ||
      paymentSource.includes("bank") ||
      paymentSource.includes("upi") ||
      paymentSource.includes("cheque")
        ? "Bank"
        : "Cash";

    if (currentCourier > 0) {
      const expenseDateIso = bill.date || now;
      const expenseDate = String(expenseDateIso).split("T")[0] || now.split("T")[0];
      const expenseTimeDate = new Date(expenseDateIso);
      const expenseTime = Number.isNaN(expenseTimeDate.getTime())
        ? "00:00"
        : expenseTimeDate.toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          });

      const courierExpense = removeUndefined({
        id: `sale-courier-${bill.id}`,
        date: expenseDate,
        time: expenseTime,
        amount: currentCourier,
        description: `Courier charge for Sale Bill ${bill.billNumber || bill.id}`,
        category: "Courier",
        paymentMethod: expensePaymentMethod,
        bankAccountId: expensePaymentMethod === "Bank" ? bill.bankAccountId : undefined,
        createdAt: now,
        userId,
        billId: bill.id,
        sourceType: "sale_courier_auto",
      });

      batch.set(courierExpenseRef, await encryptDoc(courierExpense));
    } else if (isUpdate && previousCourier > 0) {
      batch.delete(courierExpenseRef);
    }

    await batch.commit();
  } catch (error) {
    console.error("Error saving bill:", error);
    throw error;
  }
};

export const deleteBill = async (id: string): Promise<void> => {
  try {
    const userId = getUserId();
    const billRef = doc(db, COLLECTIONS.BILLS, id);
    const billSnap = await getDoc(billRef);

    if (billSnap.exists()) {
      const bill = await decryptDoc(billSnap.data() as any) as Bill;
      const batch = writeBatch(db);

      // Delete bill
      batch.delete(billRef);
      batch.delete(doc(db, COLLECTIONS.EXPENSES, `sale-courier-${id}`));

      // Return items to inventory
      for (const item of bill.items) {
        const productRef = doc(db, COLLECTIONS.PRODUCTS, item.productId);
        const productSnap = await getDoc(productRef);

        if (productSnap.exists()) {
          const product = await decryptDoc(productSnap.data() as any) as Product;
          const newStock = product.stock + item.quantity;
          batch.set(productRef, await encryptDoc(removeUndefined({ ...product, stock: newStock })));
        }
      }

      // Restore sold IMEI units for this bill
      const units = await getInventoryUnits();
      const soldUnits = units.filter((u) => u.soldBillId === id);
      for (const unit of soldUnits) {
        const unitRef = doc(db, COLLECTIONS.INVENTORY_UNITS, unit.id);
        batch.set(unitRef, await encryptDoc(removeUndefined({ ...unit, status: "in_stock", soldBillId: null, soldAt: null, updatedAt: new Date().toISOString() })));
      }

      // Delete INVENTORY transaction records written when this sale bill was saved
      const saleInvSnap = await getDocs(collection(db, COLLECTIONS.INVENTORY));
      const saleTxDocs = await Promise.all(
        saleInvSnap.docs.map(async (d) => ({ ref: d.ref, data: await decryptDoc(d.data() as any) as any })),
      );
      saleTxDocs
        .filter((t) => t.data.billId === id && t.data.type === "sale")
        .forEach((t) => batch.delete(t.ref));

      await batch.commit();
    }
  } catch (error) {
    console.error("Error deleting bill:", error);
    throw error;
  }
};

export const getBillCounter = async (type?: string): Promise<number> => {
  try {
    const userId = getUserId();
    const docId = type ? `${userId}_${type}` : userId;
    const docRef = doc(db, COLLECTIONS.BILL_COUNTER, docId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docSnap.data().counter || 0;
    }
    return 0;
  } catch (error) {
    console.error("Error getting bill counter:", error);
    return 0;
  }
};

export const incrementBillCounter = async (type?: string): Promise<number> => {
  try {
    const userId = getUserId();
    const docId = type ? `${userId}_${type}` : userId;
    const docRef = doc(db, COLLECTIONS.BILL_COUNTER, docId);
    const docSnap = await getDoc(docRef);

    const currentCounter = docSnap.exists() ? docSnap.data().counter || 0 : 0;
    const newCounter = Number(currentCounter) + 1;

    const cleanedData = removeUndefined({ counter: newCounter, userId });
    await setDoc(docRef, cleanedData, { merge: true });
    return newCounter;
  } catch (error) {
    console.error("Error incrementing bill counter:", error);
    throw error;
  }
};

// Repair missing or sold inventory units for a purchase bill.
// Safe to run on production — restores sold/missing units back to in_stock.
// Also patches existing in_stock units that are missing the serialNumber field.
// Creates missing units directly from bill data — no exact product match required.
export const repairInventoryFromBill = async (
  bill: PurchaseBill,
): Promise<{ created: number; restored: number; log: string[] }> => {
  const userId = getUserId();
  const products = await getProducts();
  const existingUnits = await getInventoryUnits();
  const batch = writeBatch(db);
  const now = new Date().toISOString();
  let created = 0;
  let restored = 0;
  const log: string[] = [];

  log.push(`Bill ID: ${bill.id} | Items: ${bill.items.length}`);

  for (const billItem of bill.items) {
    const rawImei = ((billItem as any).imeiNumber || "").trim();
    const rawSn = ((billItem as any).serialNumber || "").trim();
    const normImei = normalizeImei(rawImei);
    const normSn = normalizeImei(rawSn);
    // identifier: prefer IMEI, fall back to SN
    const identifier = normImei || normSn;

    log.push(`Item: "${billItem.description}" | IMEI: "${rawImei}" | SN: "${rawSn}" | identifier: "${identifier}"`);

    if (!identifier) {
      log.push(`  → skipped (no IMEI or SN)`);
      continue;
    }

    const matchUnit = (u: InventoryUnit) =>
      normalizeImei(u.imeiNormalized || u.imeiNumber) === identifier ||
      (u.serialNumber && normalizeImei(u.serialNumber) === identifier) ||
      // Also match if the stored imeiNumber IS the SN (SN-only items stored in imeiNumber field)
      (normSn && normalizeImei(u.imeiNumber) === normSn);

    const inStockUnit = existingUnits.find((u) => matchUnit(u) && u.status === "in_stock");

    if (inStockUnit) {
      log.push(`  → found in_stock unit id=${inStockUnit.id} | SN in DB="${inStockUnit.serialNumber ?? "(missing!)"}" | IMEI in DB="${inStockUnit.imeiNumber ?? ""}"`);
      // Patch if SN is missing OR mismatched — bill is the source of truth for SN
      const snNeedsUpdate = rawSn && inStockUnit.serialNumber !== rawSn;
      if (snNeedsUpdate) {
        const unitRef = doc(db, COLLECTIONS.INVENTORY_UNITS, inStockUnit.id);
        batch.set(unitRef, await encryptDoc(removeUndefined({ ...inStockUnit, serialNumber: rawSn, purchaseBillId: bill.id, updatedAt: now })));
        log.push(`  → patched serialNumber: "${inStockUnit.serialNumber ?? "(missing)"}" → "${rawSn}"`);
        restored++;
      } else {
        log.push(`  → SN OK (no fix needed)`);
      }
      continue;
    }

    const existingUnit = existingUnits.find(matchUnit);

    if (existingUnit) {
      // Unit exists but is not in_stock (sold / returned / etc.) — restore it
      log.push(`  → found non-in_stock unit id=${existingUnit.id} status="${existingUnit.status}" | SN in DB="${existingUnit.serialNumber ?? "(missing!)"}"`);
      const restoredUnit: Record<string, unknown> = { ...existingUnit, status: "in_stock", soldBillId: null, soldAt: null, updatedAt: now };
      if (rawSn && !existingUnit.serialNumber) {
        restoredUnit.serialNumber = rawSn;
        log.push(`  → will also patch missing serialNumber: "${rawSn}"`);
      }
      const unitRef = doc(db, COLLECTIONS.INVENTORY_UNITS, existingUnit.id);
      batch.set(unitRef, await encryptDoc(removeUndefined(restoredUnit)));
      restored++;
    } else {
      // Unit completely missing — create it from bill item data.
      // Flexible product match: exact → partial → none (still creates unit).
      log.push(`  → no unit found in Firestore — will create new unit`);
      const descLower = billItem.description.toLowerCase();
      const product =
        products.find((p) => p.name.toLowerCase() === descLower) ||
        products.find(
          (p) =>
            p.name.toLowerCase().includes(descLower) ||
            descLower.includes(p.name.toLowerCase()),
        );
      log.push(`  → product match: "${product?.name ?? "(none — will use bill description)"}"`);

      const unitRef = doc(collection(db, COLLECTIONS.INVENTORY_UNITS));
      const unit = removeUndefined({
        id: unitRef.id,
        userId,
        productId: product?.id || "",
        productName: product?.name || billItem.description,
        imeiNumber: rawImei || rawSn,
        imeiNormalized: normImei || normSn,
        serialNumber: rawSn || undefined,
        itemNo: (billItem as any).itemNo || undefined,
        model: (billItem as any).model || undefined,
        storage: (billItem as any).storage || undefined,
        color: (billItem as any).color || undefined,
        vendorId: bill.vendorId || undefined,
        vendorName: (bill as any).vendorName || undefined,
        purchaseBillId: bill.id,
        purchasePrice: Number(billItem.rate) || 0,
        sellingPrice:
          Number((billItem as any).sellingPrice) || Number(billItem.rate) || 0,
        status: "in_stock" as const,
        createdAt: bill.createdAt || now,
        updatedAt: now,
      });
      batch.set(unitRef, await encryptDoc(unit));
      created++;
    }
  }

  // Always mark the bill as addedToInventory (units are confirmed in stock)
  const billRef = doc(db, COLLECTIONS.PURCHASE_BILLS, bill.id);
  batch.set(billRef, await encryptDoc(removeUndefined({ ...bill, itemsAddedToInventory: true, inventoryAddedAt: now })));
  await batch.commit();
  log.push(`Done: created=${created} restored=${restored} | bill marked as addedToInventory`);
  return { created, restored, log };
};

// Repair bill counters by scanning actual bills and syncing counters to max found numbers.
// Safe to run on production — only updates the counter docs, never touches bill data.
export const repairBillCounters = async (): Promise<{ gst: number; nonGst: number }> => {
  try {
    const userId = getUserId();
    const q = collection(db, COLLECTIONS.BILLS);
    const snap = await getDocs(q);

    let maxGst = 0;
    let maxNonGst = 0;

    for (const d of snap.docs) {
      const decrypted = await decryptDoc(d.data() as any);
      const billNumber: string = decrypted.billNumber || "";
      // Matches trailing number in formats like GST-2026-003, INV-2026-012, etc.
      const match = billNumber.match(/(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (billNumber.toUpperCase().startsWith("GST-")) {
          if (num > maxGst) maxGst = num;
        } else {
          if (num > maxNonGst) maxNonGst = num;
        }
      }
    }

    // Write repaired counters
    await setDoc(
      doc(db, COLLECTIONS.BILL_COUNTER, `${userId}_gst-bills`),
      { counter: maxGst, userId },
      { merge: true },
    );
    await setDoc(
      doc(db, COLLECTIONS.BILL_COUNTER, `${userId}_bills`),
      { counter: maxNonGst, userId },
      { merge: true },
    );

    return { gst: maxGst, nonGst: maxNonGst };
  } catch (error) {
    console.error("Error repairing bill counters:", error);
    throw error;
  }
};

export const uploadPurchaseBillVendorImage = async (
  billId: string,
  dataUrl: string,
  side: "front" | "back"
): Promise<string> => {
  try {
    const userId = getUserId();
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const storageRef = ref(storage, `purchase-vendor-id-photos/${userId}/${billId}_${side}`);
    await uploadBytes(storageRef, blob);
    return await getDownloadURL(storageRef);
  } catch (error) {
    console.error("Error uploading purchase bill vendor image:", error);
    throw error;
  }
};

export const updatePurchaseBillImages = async (billId: string, images: string[]): Promise<void> => {
  try {
    const billRef = doc(db, COLLECTIONS.PURCHASE_BILLS, billId);
    const billSnap = await getDoc(billRef);
    if (billSnap.exists()) {
      const bill = await decryptDoc(billSnap.data() as any) as PurchaseBill;
      await setDoc(billRef, await encryptDoc(removeUndefined({
        ...bill,
        vendorImages: images.filter(Boolean),
        updatedAt: new Date().toISOString(),
      })));
    }
  } catch (error) {
    console.error("Error updating purchase bill images:", error);
    throw error;
  }
};

export const uploadBillCustomerImage = async (
  billId: string,
  dataUrl: string,
  side: "front" | "back"
): Promise<string> => {
  try {
    const userId = getUserId();
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const storageRef = ref(storage, `bill-id-photos/${userId}/${billId}_${side}`);
    await uploadBytes(storageRef, blob);
    return await getDownloadURL(storageRef);
  } catch (error) {
    console.error("Error uploading bill customer image:", error);
    throw error;
  }
};

export const uploadProductImage = async (productId: string, file: File): Promise<string> => {
  try {
    const userId = getUserId();
    const storageRef = ref(storage, `products/${userId}/${productId}_${file.name}`);
    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
  } catch (error) {
    console.error("Error uploading product image:", error);
    throw error;
  }
};

export const updateBillPayment = async (
  billId: string,
  paidAmount: number,
  paymentType: PaymentMethod,
  note?: string,
  date?: string,
  bankAccountId?: string
): Promise<void> => {
  try {
    const billRef = doc(db, COLLECTIONS.BILLS, billId);
    const billSnap = await getDoc(billRef);

    if (billSnap.exists()) {
      const bill = await decryptDoc(billSnap.data() as any) as Bill;

      const newPayment: PaymentTransaction = {
        id: crypto.randomUUID(),
        amount: paidAmount,
        method: paymentType,
        date: date || new Date().toISOString(),
        note: note,
        bankAccountId: paymentType === "Cash" ? undefined : bankAccountId,
      };

      const payments = Array.isArray(bill.payments) ? [...bill.payments, newPayment] : [newPayment];
      // Derive paidAmount from the payments array (authoritative source) to prevent
      // additive drift when bill.paidAmount is already out-of-sync with payments[].
      const newPaidAmount = payments.reduce((s, p) => s + p.amount, 0);
      let paymentStatus: Bill["paymentStatus"];
      if (newPaidAmount >= bill.total) {
        paymentStatus = newPaidAmount > bill.total ? "overpaid" : "paid";
      } else if (newPaidAmount > 0) {
        paymentStatus = "partial";
      } else {
        // Keep overdue status if due date is past, otherwise pending
        const dueDate = bill.dueDate ? new Date(bill.dueDate) : null;
        const isOverdue = Boolean(dueDate && dueDate < new Date());
        paymentStatus = isOverdue ? "overdue" : "pending";
      }

      const updateData: any = {
        paidAmount: newPaidAmount,
        paymentStatus,
        paymentType: paymentType, // Update main payment type to last used
        payments: removeUndefined(payments),
      };
      const resolvedBankAccountId =
        paymentType === "Cash"
          ? bill.bankAccountId
          : bankAccountId || bill.bankAccountId;
      if (resolvedBankAccountId !== undefined) {
        updateData.bankAccountId = resolvedBankAccountId;
      }

      await setDoc(billRef, await encryptDoc(removeUndefined({ ...bill, ...updateData })));

      // Update Expo stats if expoId is present
      if (bill.expoId) {
        const expoRef = doc(db, COLLECTIONS.EXPOS, bill.expoId);
        const expoSnap = await getDoc(expoRef);
        if (expoSnap.exists()) {
          const expoData = await decryptDoc(expoSnap.data() as any) as Expo;
          await setDoc(expoRef, await encryptDoc(removeUndefined({
            ...expoData,
            receivedAmount: (Number(expoData.receivedAmount) || 0) + paidAmount,
            receivableAmount: Math.max(0, (Number(expoData.receivableAmount) || 0) - paidAmount),
          })));
        }
      }
    }
  } catch (error) {
    console.error("Error updating bill payment:", error);
    throw error;
  }
};

export const updateBillImages = async (billId: string, images: string[]): Promise<void> => {
  try {
    const billRef = doc(db, COLLECTIONS.BILLS, billId);
    const billSnap = await getDoc(billRef);
    if (billSnap.exists()) {
      const bill = await decryptDoc(billSnap.data() as any) as Bill;
      await setDoc(billRef, await encryptDoc(removeUndefined({
        ...bill,
        customerImages: images.filter(Boolean),
        updatedAt: new Date().toISOString(),
      })));
    }
  } catch (error) {
    console.error("Error updating bill images:", error);
    throw error;
  }
};

// Inventory Transactions
export const getInventoryTransactions = async (): Promise<
  InventoryTransaction[]
> => {
  try {
    const userId = getUserId();
    const q = query(
      collection(db, COLLECTIONS.INVENTORY)
    );
    const querySnapshot = await getDocs(q);

    const transactions = await Promise.all(
      querySnapshot.docs.map(async (doc) => await decryptDoc(doc.data() as any) as InventoryTransaction)
    );

    // Sort by date descending in JavaScript (avoids index requirement)
    return transactions.sort((a, b) => {
      const dateA = new Date(a.date || 0).getTime();
      const dateB = new Date(b.date || 0).getTime();
      return dateB - dateA;
    });
  } catch (error) {
    console.error("Error getting inventory transactions:", error);
    return [];
  }
};

export const saveInventoryTransaction = async (
  transaction: InventoryTransaction
): Promise<void> => {
  try {
    const userId = getUserId();
    const docRef = doc(db, COLLECTIONS.INVENTORY, transaction.id);
    const cleanedData = removeUndefined({ ...transaction, userId });
    await setDoc(docRef, await encryptDoc(cleanedData));
  } catch (error) {
    console.error("Error saving inventory transaction:", error);
    throw error;
  }
};

// Add stock to a product with transaction tracking
export const addStockToProduct = async (
  productId: string,
  quantity: number,
  purchasePrice: number
): Promise<void> => {
  try {
    const userId = getUserId();
    const batch = writeBatch(db);

    // Get the product
    const productRef = doc(db, COLLECTIONS.PRODUCTS, productId);
    const productSnap = await getDoc(productRef);

    if (!productSnap.exists()) {
      throw new Error("Product not found");
    }

    const product = await decryptDoc(productSnap.data() as any) as Product;
    const newStock = product.stock + quantity;
    const roundedStock = Math.round(newStock * 100) / 100;

    // Update product stock
    batch.set(productRef, await encryptDoc(removeUndefined({ ...product, stock: roundedStock })));

    // Create inventory transaction
    const transactionRef = doc(collection(db, COLLECTIONS.INVENTORY));
    const transaction: InventoryTransaction = {
      id: transactionRef.id,
      productId,
      type: "purchase",
      quantity,
      date: new Date().toISOString(),
      purchasePrice,
      userId,
    };
    const cleanedTransactionData = removeUndefined(transaction);
    batch.set(transactionRef, await encryptDoc(cleanedTransactionData));

    await batch.commit();
  } catch (error) {
    console.error("Error adding stock to product:", error);
    throw error;
  }
};

// Get inventory transactions for a specific product
export const getProductTransactions = async (
  productId: string
): Promise<InventoryTransaction[]> => {
  try {
    const transactions = await getInventoryTransactions();
    return transactions.filter((t) => t.productId === productId);
  } catch (error) {
    console.error("Error getting product transactions:", error);
    return [];
  }
};

// Purchase Bills
export const getPurchaseBills = async (): Promise<PurchaseBill[]> => {
  try {
    const userId = getUserId();
    const q = query(
      collection(db, COLLECTIONS.PURCHASE_BILLS)
    );
    const querySnapshot = await getDocs(q);

    const bills = await Promise.all(querySnapshot.docs.map(async (doc) => {
      const data = await decryptDoc(doc.data() as any);
      return {
        ...data,
        items: (data.items || []).map((item: any) => ({
          ...item,
          weight: typeof item.weight === 'string' ? parseFloat(item.weight) || 0 : (item.weight || 0)
        }))
      } as PurchaseBill;
    }));

    // Sort by createdAt descending in JavaScript (avoids index requirement)
    return bills.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });
  } catch (error) {
    console.error("Error getting purchase bills:", error);
    return [];
  }
};

export const syncPurchaseBillExpenses = async (bill: PurchaseBill): Promise<void> => {
  const userId = getUserId();
  const expenseDateIso = bill.billDate || bill.createdAt || bill.updatedAt || new Date().toISOString();
  const expenseDate = String(expenseDateIso).split("T")[0] || new Date().toISOString().split("T")[0];
  const expenseTimeDate = new Date(expenseDateIso);
  const expenseTime = Number.isNaN(expenseTimeDate.getTime())
    ? "00:00"
    : expenseTimeDate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
  const defaultPaymentMethod: Expense["paymentMethod"] =
    (bill.payments || []).some((p) => ["Bank Transfer", "UPI", "Cheque"].includes(String(p.method || "")))
      ? "Bank" : "Cash";

  const syncOne = async (expenseId: string, amount: number, category: string, description: string) => {
    const expenseRef = doc(db, COLLECTIONS.EXPENSES, expenseId);
    if (amount > 0) {
      await setDoc(expenseRef, await encryptDoc(removeUndefined({
        id: expenseId, date: expenseDate, time: expenseTime, amount, description, category,
        paymentMethod: defaultPaymentMethod, createdAt: expenseDateIso,
        userId, purchaseBillId: bill.id, sourceType: "purchase_bill_auto",
      })));
    } else {
      await deleteDoc(expenseRef);
    }
  };

  await syncOne(`purchase-courier-${bill.id}`, Number(bill.courierCharges || 0), "Courier",
    `Courier charge for Purchase Bill ${bill.billNumber || bill.id} - ${bill.vendorName || "Vendor"}`);
  await syncOne(`purchase-extra-expense-${bill.id}`, Number(bill.expenseAmount || 0), "Purchase Expense",
    `Extra expense for Purchase Bill ${bill.billNumber || bill.id} - ${bill.vendorName || "Vendor"}`);

  // Repair cost expenses — use stable IMEI/SN-based ID (not positional index)
  // First delete any legacy index-based entries from before this fix
  for (let i = 0; i < 20; i++) {
    const legacyRef = doc(db, COLLECTIONS.EXPENSES, `purchase-repair-${bill.id}-item-${i}`);
    try { await deleteDoc(legacyRef); } catch { /* ignore if not exists */ }
  }
  let hasRepairCost = false;
  for (const item of bill.items) {
    const cost = Number((item as any).repairCost || 0);
    if (cost > 0) hasRepairCost = true;
    const stableKey = normalizeImei(
      (item as any).imeiNumber || (item as any).serialNumber || item.description || "item"
    ).replace(/[^a-z0-9]/g, "").slice(0, 30);
    const notes = (item as any).repairCostNotes as string | undefined;
    const label = item.description || "Item";
    const descText = notes
      ? `Repair: ${label} — ${notes} (${bill.billNumber || bill.id})`
      : `Repair: ${label} (${bill.billNumber || bill.id})`;
    await syncOne(`purchase-repair-${bill.id}-${stableKey}`, cost, "Repair Cost", descText);
  }

  // Auto-add "Repair Cost" to company profile expense categories if first use
  if (hasRepairCost) {
    try {
      const profile = await getCompanyProfile();
      if (profile && !(profile.expenseCategories || []).includes("Repair Cost")) {
        await saveCompanyProfile({
          ...profile,
          expenseCategories: [...(profile.expenseCategories || []), "Repair Cost"],
        });
      }
    } catch { /* non-critical — don't block bill save */ }
  }
};

export const updatePurchaseBill = async (bill: PurchaseBill): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTIONS.PURCHASE_BILLS, bill.id);
    const cleanedData = removeUndefined(bill);
    await setDoc(docRef, await encryptDoc(cleanedData));
    // Sync all auto-expenses (courier, extra, repair costs) whenever bill data changes
    await syncPurchaseBillExpenses(bill);
  } catch (error) {
    console.error("Error updating purchase bill:", error);
    throw error;
  }
};

export const syncBillPricesToInventory = async (bill: PurchaseBill): Promise<void> => {
  try {
    const userId = getUserId();
    const batch = writeBatch(db);

    // Fetch ALL inventory units and filter in memory. Two-pass strategy:
    // 1. Try to match by purchaseBillId (fast, exact).
    // 2. If no linked units found (purchaseBillId was inside _e on old encrypted docs),
    //    fall back to IMEI/SN-based match across all units — IMEI is globally unique so
    //    this cannot match the wrong device.
    const allUnitsSnap = await getDocs(collection(db, COLLECTIONS.INVENTORY_UNITS));
    const allUnits = await Promise.all(allUnitsSnap.docs.map(async (d) => ({ ref: d.ref, data: await decryptDoc(d.data() as any) as InventoryUnit })));
    const billLinkedUnits = allUnits.filter(u => u.data.purchaseBillId === bill.id);
    // If bill-linked units found use them; otherwise search all (for old encrypted docs)
    const billUnits = billLinkedUnits.length > 0 ? billLinkedUnits : allUnits;

    const products = await getProducts();
    const now = new Date().toISOString();

    // productId -> { purchasePrice, sellingPrice }
    const productUpdates = new Map<string, { purchasePrice?: number; sellingPrice?: number }>();

    const matchedUnitIds = new Set<string>();

    for (const item of bill.items) {
      const purchasePrice = Number(item.rate) || 0;
      const sellingPrice = Number(item.sellingPrice) || 0;

      const sn = (item.serialNumber || "").trim();
      if (item.imeiNumber || sn) {
        // Serialized item: match inventory unit by IMEI or SN
        const normalizedItemImei = normalizeImei(item.imeiNumber || "");
        const normalizedSn = normalizeImei(sn);
        let match = billUnits.find((u) =>
          !matchedUnitIds.has(u.data.id) && (
          (normalizedItemImei && (u.data.imeiNormalized === normalizedItemImei || normalizeImei(u.data.imeiNumber) === normalizedItemImei)) ||
          (normalizedSn && (normalizeImei(u.data.serialNumber || "") === normalizedSn || normalizeImei(u.data.imeiNumber) === normalizedSn))
          ),
        );

        // Fallback: if IMEI changed (typo correction), match by model+storage+color from bill units not yet matched
        if (!match && (item.model || item.storage)) {
          match = billUnits.find((u) =>
            !matchedUnitIds.has(u.data.id) &&
            (item.model ? u.data.model === item.model : true) &&
            (item.storage ? u.data.storage === item.storage : true) &&
            (item.color ? u.data.color === item.color : true),
          );
        }

        if (match) {
          matchedUnitIds.add(match.data.id);
          const repairCost = Number((item as any).repairCost || 0);
          const updates: Record<string, unknown> = { updatedAt: now };
          if (purchasePrice > 0) updates.purchasePrice = purchasePrice;
          if (sellingPrice > 0) updates.sellingPrice = sellingPrice;
          // repairCost: store separately; null clears it when removed
          updates.repairCost = repairCost > 0 ? repairCost : null;
          // Sync all device detail fields — also update IMEI if it changed (typo fix)
          if (item.imeiNumber !== undefined) { updates.imeiNumber = item.imeiNumber; updates.imeiNormalized = normalizeImei(item.imeiNumber); }
          if (item.model !== undefined) updates.model = item.model;
          if (item.storage !== undefined) updates.storage = item.storage;
          if (item.color !== undefined) updates.color = item.color;
          if ((item as any).batteryHealth !== undefined) updates.batteryHealth = (item as any).batteryHealth || null;
          if ((item as any).warranty !== undefined) updates.warranty = (item as any).warranty || null;
          if (item.serialNumber !== undefined) updates.serialNumber = item.serialNumber;
          batch.set(match.ref, await encryptDoc(removeUndefined({ ...match.data, ...updates })));

          // Queue product price updates — include purchasePrice so inventory value reflects edited bill rates
          if (match.data.productId && (purchasePrice > 0 || sellingPrice > 0)) {
            const existing = productUpdates.get(match.data.productId) || {};
            const upd: { purchasePrice?: number; sellingPrice?: number } = { ...existing };
            if (purchasePrice > 0) upd.purchasePrice = purchasePrice;
            if (sellingPrice > 0) upd.sellingPrice = sellingPrice;
            productUpdates.set(match.data.productId, upd);
          }
        }
      } else {
        // Non-serialized item: match product by name
        const product = products.find(
          (p) => p.name.toLowerCase().trim() === (item.description || "").toLowerCase().trim(),
        );
        if (product) {
          const existing = productUpdates.get(product.id) || {};
          const updates: { purchasePrice?: number; sellingPrice?: number } = { ...existing };
          if (purchasePrice > 0) updates.purchasePrice = purchasePrice;
          if (sellingPrice > 0) updates.sellingPrice = sellingPrice;
          productUpdates.set(product.id, updates);
        }
      }
    }

    // Guaranteed fallback: for every bill item with a valid rate, also do a name-based
    // product purchasePrice update. This covers serialized items whose inventory unit
    // has no productId set, and catches any name-match misses from the loop above.
    for (const item of bill.items) {
      const rate = Number(item.rate) || 0;
      // Skip if rate is 0 or looks like an IMEI/barcode (>= 10 integer digits)
      if (!rate || String(Math.round(rate)).length >= 10) continue;
      const desc = (item.description || "").toLowerCase().trim();
      const product = products.find(p => p.name.toLowerCase().trim() === desc);
      if (product) {
        const existing = productUpdates.get(product.id) || {};
        productUpdates.set(product.id, { ...existing, purchasePrice: rate });
      }
    }

    // H11: mark units that belong to this bill but weren't matched to any current item as deadstock
    // (items removed from the bill during edit)
    for (const u of billUnits) {
      if (!matchedUnitIds.has(u.data.id) && (u.data.imeiNumber || u.data.serialNumber)) {
        if (u.data.status === "in_stock" || u.data.status === "reserved") {
          batch.set(u.ref, await encryptDoc(removeUndefined({ ...u.data, status: "deadstock", updatedAt: now })));
        }
      }
    }

    for (const [productId, updates] of productUpdates) {
      const productRef = doc(db, COLLECTIONS.PRODUCTS, productId);
      const existingProduct = products.find((p) => p.id === productId);
      if (!existingProduct) continue;
      const productFields: Record<string, unknown> = { ...updates };
      if (updates.sellingPrice) productFields.price = updates.sellingPrice; // legacy field
      batch.set(productRef, await encryptDoc(removeUndefined({ ...existingProduct, ...productFields })));
    }

    // Update InventoryTransaction records so the product ledger shows corrected rates
    const invSnap = await getDocs(collection(db, COLLECTIONS.INVENTORY));
    const invDocs = await Promise.all(
      invSnap.docs.map(async (d) => ({ ref: d.ref, data: await decryptDoc(d.data() as any) as any })),
    );
    const billTxs = invDocs.filter((t) => t.data.billId === bill.id && t.data.type === "purchase");

    for (const item of bill.items) {
      const newRate = Number(item.rate) || 0;
      if (!newRate || String(Math.round(newRate)).length >= 10) continue;
      const normalizedImei = normalizeImei(item.imeiNumber || "");
      const desc = (item.description || "").toLowerCase().trim();
      const matchedProduct = products.find((p) => p.name.toLowerCase().trim() === desc);

      for (const tx of billTxs) {
        const txImei = normalizeImei(tx.data.imeiNumber || "");
        const byImei = normalizedImei && txImei && normalizedImei === txImei;
        const byProduct = matchedProduct && tx.data.productId === matchedProduct.id;
        if ((byImei || byProduct) && tx.data.purchasePrice !== newRate) {
          batch.set(tx.ref, await encryptDoc(removeUndefined({ ...tx.data, purchasePrice: newRate })));
        }
      }
    }

    await batch.commit();
  } catch (error) {
    console.error("Error syncing bill prices to inventory:", error);
    throw error;
  }
};

export const savePurchaseBill = async (bill: PurchaseBill): Promise<void> => {
  try {
    const userId = getUserId();
    const docRef = doc(db, COLLECTIONS.PURCHASE_BILLS, bill.id);
    const cleanedData = removeUndefined({ ...bill, userId });
    await setDoc(docRef, await encryptDoc(cleanedData));

    await syncPurchaseBillExpenses(bill);
  } catch (error) {
    console.error("Error saving purchase bill:", error);
    throw error;
  }
};

export const deletePurchaseBill = async (id: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTIONS.PURCHASE_BILLS, id);
    const billSnap = await getDoc(docRef);
    if (!billSnap.exists()) return;

    const bill = await decryptDoc(billSnap.data() as any) as PurchaseBill;
    const batch = writeBatch(db);

    // Delete the bill itself
    batch.delete(docRef);

    // Delete all auto-generated expenses for this bill
    const expenseSnap = await getDocs(collection(db, COLLECTIONS.EXPENSES));
    expenseSnap.docs
      .filter(
        (d) =>
          d.id === `purchase-courier-${id}` ||
          d.id === `purchase-extra-expense-${id}` ||
          d.id.startsWith(`purchase-repair-${id}-`),
      )
      .forEach((d) => batch.delete(d.ref));

    // Delete INVENTORY transaction records created when this bill was added to inventory
    const allInvSnap = await getDocs(collection(db, COLLECTIONS.INVENTORY));
    const allTxDocs = await Promise.all(
      allInvSnap.docs.map(async (d) => ({ ref: d.ref, data: await decryptDoc(d.data() as any) as any })),
    );
    allTxDocs
      .filter((t) => t.data.billId === id && t.data.type === "purchase")
      .forEach((t) => batch.delete(t.ref));

    // If items were added to inventory, reverse stock effects
    if (bill.itemsAddedToInventory) {
      const products = await getProducts();
      const allUnits = await getInventoryUnits();
      const billUnits = allUnits.filter((u) => u.purchaseBillId === id);
      const stockAdjustments = new Map<string, number>();

      // Serialized items: remove in-stock units and decrement product stock
      for (const u of billUnits) {
        if (u.status === "in_stock" || u.status === "reserved") {
          batch.delete(doc(db, COLLECTIONS.INVENTORY_UNITS, u.id));
          stockAdjustments.set(u.productId, (stockAdjustments.get(u.productId) || 0) - 1);
        }
      }

      // Non-serialized items: reverse by item quantity
      for (const item of (bill.items || [])) {
        if (!item.imeiNumber && !(item as any).serialNumber) {
          const product = products.find(
            (p) => p.name.toLowerCase().trim() === (item.description || "").toLowerCase().trim(),
          );
          if (product) {
            stockAdjustments.set(product.id, (stockAdjustments.get(product.id) || 0) - (item.quantity || 1));
          }
        }
      }

      // Apply stock adjustments to product records
      for (const [productId, adj] of stockAdjustments) {
        const product = products.find((p) => p.id === productId);
        if (product) {
          const newStock = Math.max(0, (product.stock || 0) + adj);
          batch.set(
            doc(db, COLLECTIONS.PRODUCTS, productId),
            await encryptDoc(removeUndefined({ ...product, stock: newStock })),
          );
        }
      }
    }

    await batch.commit();
  } catch (error) {
    console.error("Error deleting purchase bill:", error);
    throw error;
  }
};

export const updatePurchaseBillPayment = async (
  billId: string,
  paidAmount: number,
  paymentType: PaymentMethod,
  note?: string,
  date?: string,
  paymentId?: string, // Optional ID to edit existing payment
  bankAccountId?: string
): Promise<void> => {
  try {
    const billRef = doc(db, COLLECTIONS.PURCHASE_BILLS, billId);
    const billSnap = await getDoc(billRef);

    if (!billSnap.exists()) {
      throw new Error(`Purchase bill ${billId} not found`);
    }

    const bill = await decryptDoc(billSnap.data() as any) as PurchaseBill;
    let payments = Array.isArray(bill.payments) ? [...bill.payments] : [];

    if (paymentId) {
      // EDIT existing payment
      const index = payments.findIndex(p => p.id === paymentId);
      if (index !== -1) {
        payments[index] = {
          ...payments[index],
          amount: paidAmount,
          method: paymentType,
          date: date || payments[index].date,
          note: note !== undefined ? note : payments[index].note,
          bankAccountId:
            paymentType === "Cash"
              ? undefined
              : bankAccountId !== undefined
                ? bankAccountId
                : payments[index].bankAccountId,
        };
      }
    } else {
      // ADD new payment
      const newPayment: PaymentTransaction = {
        id: crypto.randomUUID(),
        amount: paidAmount,
        method: paymentType,
        date: date || new Date().toISOString(),
        note: note,
        bankAccountId: paymentType === "Cash" ? undefined : bankAccountId,
      };
      payments.push(newPayment);
    }

    // Re-calculate total paid amount from all payments
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    // Use net total (after returns) for payment status
    const totalReturns = (bill.returns || []).reduce((sum, r) => sum + (r.totalReturnValue || 0), 0);
    const netTotal = Math.max(0, (bill.total || 0) - totalReturns);
    const paymentStatus: PurchaseBill["paymentStatus"] =
      totalPaid > netTotal ? "overpaid" : totalPaid >= netTotal ? "paid" : totalPaid > 0 ? "partial" : "pending";

    // Build update, omitting undefined fields (Firestore rejects undefined)
    const updateData: Record<string, any> = {
      paidAmount: totalPaid,
      paymentStatus,
      payments: removeUndefined(payments),
    };
    const newBankAccountId = paymentType === "Cash"
      ? bill.bankAccountId
      : (bankAccountId || bill.bankAccountId);
    if (newBankAccountId !== undefined) {
      updateData.bankAccountId = newBankAccountId;
    }

    await setDoc(billRef, await encryptDoc(removeUndefined({ ...bill, ...updateData })));
  } catch (error) {
    console.error("Error updating purchase bill payment:", error);
    throw error;
  }
};

export const deletePurchaseBillPayment = async (billId: string, paymentId: string): Promise<void> => {
  try {
    const billRef = doc(db, COLLECTIONS.PURCHASE_BILLS, billId);
    const billSnap = await getDoc(billRef);

    if (billSnap.exists()) {
      const bill = await decryptDoc(billSnap.data() as any) as PurchaseBill;
      if (!Array.isArray(bill.payments)) return;

      const payments = bill.payments.filter(p => p.id !== paymentId);
      const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
      // Use net total (after returns) for payment status
      const totalReturns = (bill.returns || []).reduce((sum, r) => sum + (r.totalReturnValue || 0), 0);
      const netTotal = Math.max(0, (bill.total || 0) - totalReturns);
      const paymentStatus: PurchaseBill["paymentStatus"] =
        totalPaid > netTotal ? "overpaid" : totalPaid >= netTotal ? "paid" : totalPaid > 0 ? "partial" : "pending";

      await setDoc(billRef, await encryptDoc(removeUndefined({ ...bill, paidAmount: totalPaid, paymentStatus, payments: removeUndefined(payments) })));
    }
  } catch (error) {
    console.error("Error deleting purchase bill payment:", error);
    throw error;
  }
};

// Purchase Returns
export const savePurchaseReturn = async (
  returnOrder: PurchaseReturn,
  adjustStock: boolean = true
): Promise<void> => {
  try {
    const userId = getUserId();
    const batch = writeBatch(db);

    // 1. Save the return record
    const returnRef = doc(db, COLLECTIONS.PURCHASE_RETURNS, returnOrder.id);
    batch.set(returnRef, await encryptDoc(removeUndefined({ ...returnOrder, userId })));

    // 2. Update the Purchase Bill
    const billRef = doc(db, COLLECTIONS.PURCHASE_BILLS, returnOrder.purchaseBillId);
    const billSnap = await getDoc(billRef);

    if (billSnap.exists()) {
      const bill = await decryptDoc(billSnap.data() as any) as PurchaseBill;
      const currentReturns = bill.returns || [];

      // Validate: total return value must not exceed remaining bill value
      const existingReturnTotal = currentReturns.reduce((sum, r) => sum + (r.totalReturnValue || 0), 0);
      const remainingBillValue = Math.max(0, (bill.total || 0) - existingReturnTotal);
      if (returnOrder.totalReturnValue > remainingBillValue + 0.01) {
        throw new Error(
          `Return value (₹${returnOrder.totalReturnValue.toFixed(2)}) exceeds remaining bill value (₹${remainingBillValue.toFixed(2)}).`
        );
      }

      const updatedReturns = [...currentReturns, returnOrder];

      // Calculate new effective total (original total minus ALL returns including this one)
      const currentPaidAmount = bill.paidAmount || 0;
      const newEffectiveTotal = Math.max(0, remainingBillValue - returnOrder.totalReturnValue);

      // Update payment status based on new effective total (handle overpaid)
      const newPaymentStatus: PurchaseBill["paymentStatus"] =
        newEffectiveTotal === 0
          ? "paid"
          : currentPaidAmount > newEffectiveTotal
            ? "overpaid"
            : currentPaidAmount >= newEffectiveTotal
              ? "paid"
              : currentPaidAmount > 0
                ? "partial"
                : "pending";

      batch.set(billRef, await encryptDoc(removeUndefined({ ...bill, returns: removeUndefined(updatedReturns), paymentStatus: newPaymentStatus, paidAmount: Math.min(currentPaidAmount, newEffectiveTotal), updatedAt: new Date().toISOString() })));
    }

    // 3. Adjust Stock if requested
    if (adjustStock) {
      const products = await getProducts();
      const inventoryUnits = await getInventoryUnits();

      for (const item of returnOrder.items) {
        const normalizedImei = normalizeImeiText(item.imeiNumber);
        const isSerialized = Boolean(item.inventoryUnitId || normalizedImei);
        if (isSerialized && item.quantity !== 1) {
          throw new Error(
            `Serialized purchase return item "${item.description}" must have quantity 1.`,
          );
        }

        let matchedUnit: InventoryUnit | undefined;
        if (isSerialized) {
          matchedUnit =
            inventoryUnits.find((u) => u.id === item.inventoryUnitId) ||
            inventoryUnits.find(
              (u) =>
                normalizeImeiText(u.imeiNormalized || u.imeiNumber) === normalizedImei,
            );
          if (!matchedUnit) {
            throw new Error(
              `Could not find inventory unit for purchase return item "${item.description}" (${item.imeiNumber || "unknown IMEI"}).`,
            );
          }
          if (matchedUnit.status !== "in_stock") {
            throw new Error(
              `IMEI ${matchedUnit.imeiNumber} is not in stock (current status: ${matchedUnit.status}).`,
            );
          }
          if (item.productId && matchedUnit.productId !== item.productId) {
            throw new Error(
              `IMEI ${matchedUnit.imeiNumber} does not belong to selected product.`,
            );
          }
        }

        const matchedProduct =
          products.find((p) => p.id === item.productId) ||
          (matchedUnit
            ? products.find((p) => p.id === matchedUnit?.productId)
            : undefined) ||
          products.find(
            (p) =>
              p.name.toLowerCase().trim() ===
              (item.description || item.productName || "").toLowerCase().trim(),
          );

        if (!matchedProduct) {
          throw new Error(`Product not found for return item: ${item.description}`);
        }

        const currentStock = matchedProduct.stock || 0;
        const newStock = currentStock - item.quantity;
        if (!matchedUnit && newStock < 0) {
          throw new Error(
            `Insufficient stock for return item "${item.description}". Available: ${currentStock}, requested: ${item.quantity}.`,
          );
        }

        if (matchedUnit) {
          // Serialized product: InventoryUnit status change drives the stock count.
          // Do NOT decrement product.stock to avoid double-counting.
          batch.set(doc(db, COLLECTIONS.INVENTORY_UNITS, matchedUnit.id), await encryptDoc(removeUndefined({ ...matchedUnit, status: "returned", notes: `Returned to vendor via purchase return ${returnOrder.id}`, updatedAt: new Date().toISOString() })));
        } else {
          // Non-serialized: decrement product.stock directly
          batch.set(doc(db, COLLECTIONS.PRODUCTS, matchedProduct.id), await encryptDoc(removeUndefined({ ...matchedProduct, stock: Math.round(newStock * 100) / 100 })));
        }

        // Record inventory transaction for the return
        const transactionRef = doc(collection(db, COLLECTIONS.INVENTORY));
        const transaction = {
          id: transactionRef.id,
          productId: matchedProduct.id,
          purchaseReturnId: returnOrder.id,
          type: "purchase_return" as const,
          quantity: -item.quantity,
          date: returnOrder.returnDate || new Date().toISOString(),
          inventoryUnitId: matchedUnit?.id || item.inventoryUnitId,
          imeiNumber: matchedUnit?.imeiNumber || item.imeiNumber || "",
          purchasePrice:
            matchedUnit?.purchasePrice ||
            matchedProduct.purchasePrice ||
            item.rate ||
            0,
          userId,
        };
        batch.set(transactionRef, await encryptDoc(removeUndefined(transaction)));
      }
    }

    await batch.commit();
  } catch (error) {
    console.error("Error saving purchase return:", error);
    throw error;
  }
};

export const deletePurchaseReturn = async (returnId: string, purchaseBillId: string, adjustStock: boolean = true): Promise<void> => {
  try {
    const userId = getUserId();
    const batch = writeBatch(db);

    // 1. Delete return record
    const returnRef = doc(db, COLLECTIONS.PURCHASE_RETURNS, returnId);
    const returnSnap = await getDoc(returnRef);
    if (!returnSnap.exists()) return;
    const returnOrder = await decryptDoc(returnSnap.data() as any) as PurchaseReturn;
    batch.delete(returnRef);

    // 2. Update Purchase Bill
    const billRef = doc(db, COLLECTIONS.PURCHASE_BILLS, purchaseBillId);
    const billSnap = await getDoc(billRef);

    if (billSnap.exists()) {
      const bill = await decryptDoc(billSnap.data() as any) as PurchaseBill;
      const updatedReturns = (bill.returns || []).filter(r => r.id !== returnId);

      // Effective total after deleting this return = original total minus remaining returns
      const currentPaidAmount = bill.paidAmount || 0;
      const remainingReturnsTotal = updatedReturns.reduce((sum, r) => sum + (r.totalReturnValue || 0), 0);
      const effectiveTotal = Math.max(0, (bill.total || 0) - remainingReturnsTotal);
      const newPaymentStatus: PurchaseBill["paymentStatus"] =
        effectiveTotal === 0
          ? "paid"
          : currentPaidAmount > effectiveTotal
            ? "overpaid"
            : currentPaidAmount >= effectiveTotal
              ? "paid"
              : currentPaidAmount > 0
                ? "partial"
                : "pending";

      batch.set(billRef, await encryptDoc(removeUndefined({ ...bill, returns: removeUndefined(updatedReturns), paymentStatus: newPaymentStatus, updatedAt: new Date().toISOString() })));
    }

    // 3. Revert Stock
    if (adjustStock) {
      const products = await getProducts();
      const inventoryUnits = await getInventoryUnits();
      // Encrypted docs store purchaseReturnId inside _e — fetch all and filter in memory.
      const allReturnInvSnap = await getDocs(collection(db, COLLECTIONS.INVENTORY));
      const allReturnTxDocs = await Promise.all(
        allReturnInvSnap.docs.map(async (d) => ({ ref: d.ref, data: await decryptDoc(d.data() as any) }))
      );
      allReturnTxDocs.filter(t => t.data.purchaseReturnId === returnId).forEach(t => batch.delete(t.ref));

      for (const item of returnOrder.items) {
        const normalizedImei = normalizeImeiText(item.imeiNumber);
        const matchedUnit =
          inventoryUnits.find((u) => u.id === item.inventoryUnitId) ||
          inventoryUnits.find(
            (u) =>
              normalizeImeiText(u.imeiNormalized || u.imeiNumber) === normalizedImei,
          );
        const matchedProduct =
          products.find((p) => p.id === item.productId) ||
          (matchedUnit
            ? products.find((p) => p.id === matchedUnit.productId)
            : undefined) ||
          products.find(
            (p) =>
              p.name.toLowerCase().trim() ===
              (item.description || item.productName || "").toLowerCase().trim(),
          );

        if (!matchedProduct) {
          throw new Error(`Product not found while reverting return item: ${item.description}`);
        }

        if (matchedUnit) {
          // Serialized item: restoring unit to in_stock is sufficient — do NOT also increment
          // product.stock manually, mirroring savePurchaseReturn which only changes unit status
          // for serialized items to avoid double-counting.
          const restoredNotes = matchedUnit.notes === `Returned to vendor via purchase return ${returnId}` ? "" : matchedUnit.notes || "";
          batch.set(doc(db, COLLECTIONS.INVENTORY_UNITS, matchedUnit.id), await encryptDoc(removeUndefined({ ...matchedUnit, status: "in_stock", notes: restoredNotes, updatedAt: new Date().toISOString() })));
        } else {
          // Non-serialized item: restore stock directly on the product record
          const newStock = (matchedProduct.stock || 0) + item.quantity;
          batch.set(doc(db, COLLECTIONS.PRODUCTS, matchedProduct.id), await encryptDoc(removeUndefined({ ...matchedProduct, stock: Math.round(newStock * 100) / 100 })));
        }
      }
    }

    await batch.commit();
  } catch (error) {
    console.error("Error deleting purchase return:", error);
    throw error;
  }
};

export const getInventoryUnits = async (): Promise<InventoryUnit[]> => {
  try {
    const userId = getUserId();
    const q = query(
      collection(db, COLLECTIONS.INVENTORY_UNITS),
    );
    const querySnapshot = await getDocs(q);
    return await Promise.all(querySnapshot.docs.map(async (d) => await decryptDoc(d.data() as any) as InventoryUnit));
  } catch (error) {
    console.error("Error getting inventory units:", error);
    return [];
  }
};

export const getAvailableInventoryUnits = async (
  productId?: string,
): Promise<InventoryUnit[]> => {
  try {
    const all = await getInventoryUnits();
    const filtered = all.filter((u) => {
      if (u.status !== "in_stock") return false;
      if (productId && u.productId !== productId) return false;
      return true;
    });
    return filtered.sort((a, b) => {
      const dA = new Date(a.createdAt || 0).getTime();
      const dB = new Date(b.createdAt || 0).getTime();
      return dB - dA;
    });
  } catch (error) {
    console.error("Error getting available inventory units:", error);
    return [];
  }
};

export const getInventoryUnitByImei = async (
  imei: string,
): Promise<InventoryUnit | null> => {
  try {
    const normalized = normalizeImeiText(imei);
    if (!normalized) return null;
    const all = await getInventoryUnits();
    return (
      all.find(
        (u) =>
          normalizeImeiText(u.imeiNormalized || u.imeiNumber) === normalized,
      ) || null
    );
  } catch (error) {
    console.error("Error getting inventory unit by IMEI:", error);
    return null;
  }
};

export const saveInventoryUnit = async (unit: InventoryUnit): Promise<void> => {
  try {
    const userId = getUserId();
    const now = new Date().toISOString();
    const docRef = doc(db, COLLECTIONS.INVENTORY_UNITS, unit.id);
    await setDoc(
      docRef,
      await encryptDoc(removeUndefined({
        ...unit,
        userId,
        imeiNormalized: normalizeImeiText(unit.imeiNumber),
        updatedAt: unit.updatedAt || now,
      })),
    );
  } catch (error) {
    console.error("Error saving inventory unit:", error);
    throw error;
  }
};

const normalizeImeiText = (value?: string): string =>
  (value || "").toString().replace(/\s+/g, "").trim().toLowerCase();

const findMatchedBillItemForReturn = (
  bill: Bill,
  item: {
    productId: string;
    inventoryUnitId?: string;
    imeiNumber?: string;
  },
) =>
  bill.items.find(
    (billItem) =>
      Boolean(item.inventoryUnitId) &&
      Boolean((billItem as any).inventoryUnitId) &&
      (billItem as any).inventoryUnitId === item.inventoryUnitId,
  ) ||
  bill.items.find(
    (billItem) =>
      normalizeImeiText(item.imeiNumber) &&
      normalizeImeiText((billItem as any).imeiNumber) ===
        normalizeImeiText(item.imeiNumber),
  ) ||
  bill.items.find((billItem) => billItem.productId === item.productId);

const calculateReturnAdjustedBillSnapshot = (
  bill: Bill,
  returnItems: {
    productId: string;
    quantity: number;
    inventoryUnitId?: string;
    imeiNumber?: string;
  }[],
  customReturnAmount = 0,
) => {
  const isItemWise = returnItems.length > 0;
  const matchedBillItemIds = new Set<number>();
  const updatedItems = isItemWise
    ? bill.items
        .map((item, billItemIndex) => {
          const billItemIsSerialized = Boolean(
            (item as any).inventoryUnitId ||
              normalizeImeiText((item as any).imeiNumber),
          );
          const returnItem = returnItems.find((returnEntry) => {
            if (matchedBillItemIds.has(billItemIndex)) return false;
            const returnItemIsSerialized = Boolean(
              returnEntry.inventoryUnitId ||
                normalizeImeiText(returnEntry.imeiNumber),
            );

            if (billItemIsSerialized || returnItemIsSerialized) {
              if (returnEntry.inventoryUnitId && (item as any).inventoryUnitId) {
                return returnEntry.inventoryUnitId === (item as any).inventoryUnitId;
              }
              if (
                normalizeImeiText(returnEntry.imeiNumber) &&
                normalizeImeiText((item as any).imeiNumber)
              ) {
                return (
                  normalizeImeiText(returnEntry.imeiNumber) ===
                  normalizeImeiText((item as any).imeiNumber)
                );
              }
              return false;
            }

            return returnEntry.productId === item.productId;
          });

          if (!returnItem) {
            return item;
          }

          matchedBillItemIds.add(billItemIndex);
          const newQuantity = item.quantity - returnItem.quantity;
          return {
            ...item,
            quantity: newQuantity,
            amount: roundToTwo(newQuantity * item.ratePerUnit),
          };
        })
        .filter((item) => item.quantity > 0)
    : [...bill.items];

  const subtotal = roundToTwo(
    updatedItems.reduce((sum, item) => sum + item.amount, 0),
  );
  const discount = Math.min(roundToTwo(bill.discount || 0), subtotal);
  const courierCharges = roundToTwo(bill.courierCharges || 0);
  const amountOnlyDeduction = isItemWise ? 0 : roundToTwo(customReturnAmount || 0);
  // Include GST in snapshot total so refund limits are correct for GST invoices
  let snapshotTax = 0;
  if ((bill as any).isGst && (bill as any).gstRate) {
    const taxableAmount = Math.max(0, subtotal - discount);
    snapshotTax = roundToTwo(taxableAmount * (bill as any).gstRate / 100);
  }
  const rawTotal = Math.max(
    0,
    roundToTwo(subtotal - discount + courierCharges + snapshotTax - amountOnlyDeduction),
  );
  // Round off removed per client requirement: total is the exact calculated amount
  const roundedTotal = rawTotal;
  const roundOff = 0;
  const paidAmount = roundToTwo(bill.paidAmount || 0);
  const refundableLimit = Math.max(0, roundToTwo(paidAmount - roundedTotal));
  const pendingAfterReturn = Math.max(0, roundToTwo(roundedTotal - paidAmount));

  return {
    updatedItems,
    subtotal,
    discount,
    courierCharges,
    rawTotal,
    roundedTotal,
    roundOff,
    refundableLimit,
    pendingAfterReturn,
  };
};

const isSerializedTracking = (product?: Product | null): boolean =>
  (product?.trackingType || "standard") === "serialized";

const normalizeVariantPart = (value?: string): string =>
  (value || "").toString().trim().toLowerCase();

const normalizeImei = (value?: string): string =>
  (value || "").toString().replace(/\s+/g, "").toLowerCase();

const buildVariantKey = (item: {
  description?: string;
  name?: string;
  model?: string;
  storage?: string;
  color?: string;
}): string =>
  [
    normalizeVariantPart(item.description || item.name),
    normalizeVariantPart(item.model),
    normalizeVariantPart(item.storage),
    normalizeVariantPart(item.color),
  ].join("|");

const buildProductMasterKey = (item: {
  description?: string;
  name?: string;
  model?: string;
}): string =>
  [
    normalizeVariantPart(item.description || item.name),
    normalizeVariantPart(item.model),
  ].join("|");

// Validate IMEI/serial numbers on purchase bill items BEFORE saving the bill.
// Returns an array of human-readable error strings (empty = no conflicts).
export const validatePurchaseBillImeis = async (
  items: Array<{ imeiNumber?: string; serialNumber?: string; description?: string; quantity?: number }>
): Promise<string[]> => {
  const existingUnits = await getInventoryUnits();
  const errors: string[] = [];
  const seenIdentifiers = new Set<string>();

  for (const item of items) {
    const normalizedImei = normalizeImei(item.imeiNumber);
    const normalizedSn = item.serialNumber?.trim() ? normalizeImei(item.serialNumber.trim()) : "";
    const identifier = normalizedImei || normalizedSn;
    if (!identifier) continue;

    if (seenIdentifiers.has(identifier)) {
      errors.push(`Duplicate IMEI/Serial in this bill: ${item.imeiNumber || item.serialNumber || ""}`);
      continue;
    }
    seenIdentifiers.add(identifier);

    const existingInStockUnit = existingUnits.find(
      (u) =>
        (u.status === "in_stock" || u.status === "reserved") &&
        normalizeImei(u.imeiNormalized || u.imeiNumber) === identifier,
    );
    if (existingInStockUnit) {
      const from = existingInStockUnit.vendorName || "unknown party";
      errors.push(
        `${item.imeiNumber || item.serialNumber || ""} is already in stock (purchased from "${from}"). Sell it first before re-purchasing.`,
      );
    }

    if (normalizedImei && normalizedSn) {
      const snConflict = existingUnits.find(
        (u) =>
          (u.status === "in_stock" || u.status === "reserved") &&
          normalizeImei(u.serialNumber || "") === normalizedSn &&
          normalizeImei(u.imeiNormalized || u.imeiNumber) !== normalizedImei,
      );
      if (snConflict) {
        errors.push(
          `Serial number ${item.serialNumber} is already assigned to another in-stock unit (IMEI: ${snConflict.imeiNumber || "none"}).`,
        );
      }
    }
  }
  return errors;
};

export const addPurchaseItemsToInventory = async (
  bill: PurchaseBill,
  itemsWithSellingPrice: InventoryItemInput[],
  conflictResolutions?: Map<string, string> // HSN -> chosen name
): Promise<InventoryAddResult> => {
  try {
    const userId = getUserId();
    const products = await getProducts();
    const batch = writeBatch(db);

    let added = 0;
    let updated = 0;
    const conflicts: ProductConflict[] = [];
    const seenImeis = new Set<string>();
    const existingUnits = await getInventoryUnits();

    // --- Pre-validation: collect ALL IMEI/SN errors before touching the batch ---
    const imeiErrors: string[] = [];
    for (const item of itemsWithSellingPrice) {
      const normalizedImei = normalizeImei(item.imeiNumber);
      const normalizedSn = item.serialNumber?.trim() ? normalizeImei(item.serialNumber.trim()) : "";
      const identifier = normalizedImei || normalizedSn;
      const isSerializedItem = Boolean(identifier);

      if (isSerializedItem && Number(item.quantity) !== 1) {
        imeiErrors.push(`"${item.description}" must have quantity 1 (has IMEI/Serial).`);
        continue;
      }

      if (!identifier) continue;

      if (seenImeis.has(identifier)) {
        imeiErrors.push(`Duplicate in this bill: ${item.imeiNumber || item.serialNumber || ""}`);
        continue;
      }
      seenImeis.add(identifier);

      // Block if a unit with this IMEI/SN-identifier is currently in_stock (not yet sold).
      const existingInStockUnit = existingUnits.find(
        (u) =>
          (u.status === "in_stock" || u.status === "reserved") &&
          normalizeImei(u.imeiNormalized || u.imeiNumber) === identifier,
      );
      if (existingInStockUnit) {
        const from = existingInStockUnit.vendorName || "unknown party";
        imeiErrors.push(
          `${item.imeiNumber || item.serialNumber || ""} is already in stock — purchased from "${from}". Sell it first before re-purchasing.`,
        );
      }

      // Guard: if item has IMEI, also check that its serial number is not already
      // used by a DIFFERENT in-stock unit (catches duplicate SNs caused by counter bugs).
      if (normalizedImei && normalizedSn) {
        const snConflict = existingUnits.find(
          (u) =>
            (u.status === "in_stock" || u.status === "reserved") &&
            normalizeImei(u.serialNumber || "") === normalizedSn &&
            normalizeImei(u.imeiNormalized || u.imeiNumber) !== normalizedImei,
        );
        if (snConflict) {
          imeiErrors.push(
            `Serial number ${item.serialNumber} is already assigned to another in-stock unit (IMEI: ${snConflict.imeiNumber || "none"}, ${snConflict.model || snConflict.productName || "unknown model"}). Check serial number settings.`,
          );
        }
      }
    }

    // Fail fast with ALL errors listed so the user can fix everything at once
    if (imeiErrors.length > 0) {
      throw new Error(
        `Cannot add to inventory — ${imeiErrors.length} IMEI/Serial issue(s):\n• ${imeiErrors.join("\n• ")}`,
      );
    }

    for (const item of itemsWithSellingPrice) {
      const itemMasterKey = buildProductMasterKey(item);

      // 1. Check for manual product selection (isNewProduct = false)
      if (item.isNewProduct === false && item.productId) {
        const selectedProduct = products.find((p) => p.id === item.productId);
        if (selectedProduct) {
          await updateExistingProduct(selectedProduct, item, bill, batch, userId, existingUnits);
          updated++;
          continue;
        }
      }

      // 2. Check for manual "Create New" (isNewProduct = true)
      if (item.isNewProduct === true) {
        await createNewProduct(item, bill, batch, userId, existingUnits);
        added++;
        continue;
      }

      // 3. Conflict resolution takes precedence if provided (legacy/fallback)
      if (conflictResolutions && conflictResolutions.has(item.description || "")) {
        const chosenName = conflictResolutions.get(item.description || "")!;
        const productsWithSameHSN = products.filter(
          (p) => p.hsnCode === item.hsnCode,
        );
        const productToUpdate =
          productsWithSameHSN.find(
            (p) =>
              p.name === chosenName &&
              buildProductMasterKey(p) === itemMasterKey,
          ) ||
          productsWithSameHSN.find(
            (p) => buildProductMasterKey(p) === itemMasterKey,
          ) ||
          productsWithSameHSN.find((p) => p.name === chosenName) ||
          productsWithSameHSN[0];

        if (productToUpdate) {
          await updateExistingProductWithNameChange(
            productToUpdate,
            item,
            chosenName,
            bill,
            batch,
            userId,
            existingUnits,
          );
          updated++;
          continue;
        }
      }

      // 4. Default automated matching logic
      if (true) { // Always use name matching
        const existingProduct = products.find((p) =>
          buildProductMasterKey(p) === itemMasterKey ||
          p.name.toLowerCase() === item.description.toLowerCase(),
        );
        if (existingProduct) {
          await updateExistingProduct(existingProduct, item, bill, batch, userId, existingUnits);
          updated++;
        } else {
          await createNewProduct(item, bill, batch, userId, existingUnits);
          added++;
        }
        continue;
      }

      const productsWithSameHSN = products.filter(
        (p) => p.barcode && p.barcode === item.barcode,
      );

      if (productsWithSameHSN.length === 0) {
        await createNewProduct(item, bill, batch, userId, existingUnits);
        added++;
        continue;
      }

      const masterMatch = productsWithSameHSN.find(
        (p) => buildProductMasterKey(p) === itemMasterKey,
      );
      if (masterMatch) {
        await updateExistingProduct(masterMatch, item, bill, batch, userId, existingUnits);
        updated++;
        continue;
      }

      const exactMatch = productsWithSameHSN.find(
        (p) => p.name.toLowerCase() === item.description.toLowerCase(),
      );
      if (exactMatch) {
        await updateExistingProduct(exactMatch, item, bill, batch, userId, existingUnits);
        updated++;
        continue;
      }

      // Conflict detected
      conflicts.push({
        item,
        existingProducts: [productsWithSameHSN[0]],
        conflictType: "name-mismatch",
      });
    }

    // Only commit if no conflicts or conflicts are resolved
    if (conflicts.length === 0) {
      const billRef = doc(db, COLLECTIONS.PURCHASE_BILLS, bill.id);

      // H6: guard against double-add race — atomically claim the "not yet added" slot
      let alreadyAdded = false;
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(billRef);
        if (!snap.exists()) return;
        const snapDecrypted = await decryptDoc(snap.data() as any) as PurchaseBill;
        if (snapDecrypted.itemsAddedToInventory === true) {
          alreadyAdded = true;
          return;
        }
        tx.set(billRef, await encryptDoc(removeUndefined({ ...snapDecrypted, itemsAddedToInventory: true, inventoryAddedAt: new Date().toISOString() })));
      });

      if (alreadyAdded) {
        return { added: 0, updated: 0, conflicts: [] };
      }

      // itemsAddedToInventory flag is now atomically set; commit inventory units
      await batch.commit();
    }

    return { added, updated, conflicts };
  } catch (error) {
    console.error("Error adding purchase items to inventory:", error);
    throw error;
  }
};

export interface InventoryItemInput {
  description: string;
  hsnCode?: string;
  barcode?: string;
  vendorId?: string;
  itemNo?: string;
  model?: string;
  imeiNumber?: string;
  serialNumber?: string; // Auto-generated SN, e.g. AM-01
  storage?: string;
  color?: string;
  batteryHealth?: string;
  warranty?: string;
  withBill?: boolean;
  quantity: number;
  unit: string;
  purchasePrice: number;
  sellingPrice?: number;
  gstRate?: number;
  productId?: string;
  isNewProduct?: boolean;
}

const addInventoryUnitForPurchase = async (
  batch: any,
  userId: string,
  item: InventoryItemInput,
  product: Product,
  bill: PurchaseBill,
  existingUnits: InventoryUnit[] = [],
) => {
  const normalizedImei = normalizeImei(item.imeiNumber);
  const hasSn = Boolean(item.serialNumber?.trim());
  // Require either IMEI or SN to create an inventory unit
  if (!normalizedImei && !hasSn) return;

  // For SN-only items (no IMEI), use the SN as the imeiNumber identifier
  const effectiveImei = normalizedImei || (item.serialNumber!.trim());
  const effectiveNormalized = normalizedImei || normalizeImei(item.serialNumber!.trim());
  const now = new Date().toISOString();

  // Re-purchase check: if a unit already exists in_stock with the same IMEI,
  // update it (fix SN, link to new bill) instead of creating a duplicate unit.
  const existingUnit = existingUnits.find(
    (u) =>
      (normalizeImei(u.imeiNormalized || u.imeiNumber) === effectiveNormalized ||
        (u.serialNumber && normalizeImei(u.serialNumber) === effectiveNormalized)) &&
      (u.status === "in_stock" || u.status === "reserved"),
  );
  if (existingUnit) {
    const updates: Record<string, unknown> = { purchaseBillId: bill.id, purchasePrice: item.purchasePrice, updatedAt: now };
    if (item.repairCost && item.repairCost > 0) updates.repairCost = item.repairCost;
    if (item.withBill !== undefined) updates.withBill = item.withBill;
    const newSn = item.serialNumber?.trim() || "";
    if (newSn && existingUnit.serialNumber !== newSn) updates.serialNumber = newSn;
    batch.set(doc(db, COLLECTIONS.INVENTORY_UNITS, existingUnit.id), await encryptDoc(removeUndefined({ ...existingUnit, ...updates })));
    return;
  }

  const unitRef = doc(collection(db, COLLECTIONS.INVENTORY_UNITS));
  const unit: InventoryUnit = {
    id: unitRef.id,
    userId,
    productId: product.id,
    productName: product.name,
    imeiNumber: item.imeiNumber || effectiveImei,
    imeiNormalized: effectiveNormalized,
    serialNumber: item.serialNumber?.trim() || undefined,
    variantKey: buildVariantKey({
      description: item.description || product.name,
      model: item.model || product.model || "",
      storage: item.storage || product.storage || "",
      color: item.color || product.color || "",
      itemNo: item.itemNo || product.itemNo || "",
    }),
    itemNo: item.itemNo || product.itemNo || "",
    model: item.model || product.model || "",
    storage: item.storage || product.storage || "",
    color: item.color || product.color || "",
    batteryHealth: item.batteryHealth || undefined,
    warranty: item.warranty || undefined,
    withBill: item.withBill,
    vendorId: item.vendorId || bill.vendorId || "",
    vendorName: bill.vendorName || "",
    purchaseBillId: bill.id,
    purchasePrice: item.purchasePrice,
    repairCost: item.repairCost && item.repairCost > 0 ? item.repairCost : undefined,
    sellingPrice: item.sellingPrice,
    status: "in_stock",
    createdAt: now,
    updatedAt: now,
  };

  batch.set(unitRef, await encryptDoc(removeUndefined(unit)));
};

const updateExistingProduct = async (
  existingProduct: Product,
  item: InventoryItemInput,
  bill: PurchaseBill,
  batch: any,
  userId: string,
  existingUnits: InventoryUnit[] = [],
) => {
  const productRef = doc(db, COLLECTIONS.PRODUCTS, existingProduct.id);
  const currentStock = existingProduct.stock || 0;
  const currentPurchasePrice = existingProduct.purchasePrice || 0;
  
  // Calculate new stock
  const newStock = Math.round((currentStock + item.quantity) * 100) / 100;
  
  // Calculate new weighted average purchase price
  // Formula: ((Existing Stock * Old Avg Price) + (New Quantity * New Purchase Price)) / New Total Stock
  let newPurchasePrice = item.purchasePrice;
  if (newStock > 0) {
    const existingValue = currentStock * currentPurchasePrice;
    const newValue = item.quantity * item.purchasePrice;
    newPurchasePrice = Math.round(((existingValue + newValue) / newStock) * 100) / 100;
  }

  const updates: any = {
    stock: newStock,
    purchasePrice: newPurchasePrice,
    trackingType:
      normalizeImei(item.imeiNumber) ? "serialized" : existingProduct.trackingType || "standard",
    variantKey: buildProductMasterKey({
      description: item.description || existingProduct.name,
      model: item.model || existingProduct.model || "",
    }),
    model: item.model || existingProduct.model || "",
    imeiNumber: existingProduct.imeiNumber || "",
    storage: existingProduct.storage || "",
    color: existingProduct.color || "",
    itemNo: item.itemNo || existingProduct.itemNo || "",
  };

  if (item.sellingPrice > 0) {
    updates.sellingPrice = item.sellingPrice;
    updates.price = item.sellingPrice;
  }

  batch.set(productRef, await encryptDoc(removeUndefined({ ...existingProduct, ...updates })));

  // Create inventory transaction record
  const transactionRef = doc(collection(db, COLLECTIONS.INVENTORY));
  const transaction: InventoryTransaction = {
    id: transactionRef.id,
    productId: existingProduct.id,
    billId: bill.id,
    type: "purchase" as const,
    quantity: item.quantity,
    date: bill.billDate || bill.createdAt,
    purchasePrice: item.purchasePrice,
    itemNo: item.itemNo || existingProduct.itemNo || "",
    model: item.model || existingProduct.model || "",
    imeiNumber: item.imeiNumber || existingProduct.imeiNumber || "",
    storage: item.storage || existingProduct.storage || "",
    color: item.color || existingProduct.color || "",
    vendorId: item.vendorId || bill.vendorId || "",
    vendorName: bill.vendorName || "",
    userId,
  };
  const cleanedTransactionData = removeUndefined(transaction);
  batch.set(transactionRef, await encryptDoc(cleanedTransactionData));

  const productForUnit: Product = { ...existingProduct, ...updates };
  if (isSerializedTracking(productForUnit) || Boolean(item.imeiNumber?.trim()) || Boolean(item.serialNumber?.trim())) {
    await addInventoryUnitForPurchase(batch, userId, item, productForUnit, bill, existingUnits);
  }
};

const updateExistingProductWithNameChange = async (
  existingProduct: Product,
  item: InventoryItemInput,
  chosenName: string,
  bill: PurchaseBill,
  batch: any,
  userId: string,
  existingUnits: InventoryUnit[] = [],
) => {
  const productRef = doc(db, COLLECTIONS.PRODUCTS, existingProduct.id);
  const currentStock = existingProduct.stock || 0;
  const currentPurchasePrice = existingProduct.purchasePrice || 0;
  
  // Calculate new stock
  const newStock = Math.round((currentStock + item.quantity) * 100) / 100;
  
  // Calculate new weighted average purchase price
  let newPurchasePrice = item.purchasePrice;
  if (newStock > 0) {
    const existingValue = currentStock * currentPurchasePrice;
    const newValue = item.quantity * item.purchasePrice;
    newPurchasePrice = Math.round(((existingValue + newValue) / newStock) * 100) / 100;
  }

  const updates: any = {
    name: chosenName, // Update name
    stock: newStock,
    purchasePrice: newPurchasePrice,
    trackingType:
      normalizeImei(item.imeiNumber) ? "serialized" : existingProduct.trackingType || "standard",
    variantKey: buildProductMasterKey({
      description: chosenName,
      model: item.model || existingProduct.model || "",
    }),
    unit: item.unit || existingProduct.unit,
    model: item.model || existingProduct.model || "",
    imeiNumber: existingProduct.imeiNumber || "",
    storage: existingProduct.storage || "",
    color: existingProduct.color || "",
    itemNo: item.itemNo || existingProduct.itemNo || "",
  };

  if (item.sellingPrice > 0) {
    updates.sellingPrice = item.sellingPrice;
    updates.price = item.sellingPrice;
  }

  batch.set(productRef, await encryptDoc(removeUndefined({ ...existingProduct, ...updates })));

  // Create inventory transaction record
  const transactionRef = doc(collection(db, COLLECTIONS.INVENTORY));
  const transaction: InventoryTransaction = {
    id: transactionRef.id,
    productId: existingProduct.id,
    billId: bill.id,
    type: "purchase" as const,
    quantity: item.quantity,
    date: bill.billDate || bill.createdAt,
    purchasePrice: item.purchasePrice,
    itemNo: item.itemNo || existingProduct.itemNo || "",
    model: item.model || existingProduct.model || "",
    imeiNumber: item.imeiNumber || existingProduct.imeiNumber || "",
    storage: item.storage || existingProduct.storage || "",
    color: item.color || existingProduct.color || "",
    vendorId: item.vendorId || bill.vendorId || "",
    vendorName: bill.vendorName || "",
    userId,
  };
  const cleanedTransactionData = removeUndefined(transaction);
  batch.set(transactionRef, await encryptDoc(cleanedTransactionData));

  const productForUnit: Product = { ...existingProduct, ...updates };
  if (isSerializedTracking(productForUnit) || Boolean(item.imeiNumber?.trim()) || Boolean(item.serialNumber?.trim())) {
    await addInventoryUnitForPurchase(batch, userId, item, productForUnit, bill, existingUnits);
  }
};

const createNewProduct = async (
  item: InventoryItemInput,
  bill: PurchaseBill,
  batch: any,
  userId: string,
  existingUnits: InventoryUnit[] = [],
) => {
  const isSerializedItem = Boolean(normalizeImei(item.imeiNumber)) || Boolean(item.serialNumber?.trim());
  const newProduct: Product = {
    id: crypto.randomUUID(),
    name: item.description,
    variantKey: buildProductMasterKey(item),
    trackingType: isSerializedItem ? "serialized" : "standard",
    itemNo: item.itemNo || "",
    model: item.model || "",
    imeiNumber: "",
    storage: "",
    color: "",
    unit: item.unit || "pcs",
    price: item.sellingPrice || 0,
    purchasePrice: item.purchasePrice,
    sellingPrice: item.sellingPrice || 0,
    stock: item.quantity,
    createdAt: new Date().toISOString(),
    whereToBuy: bill.vendorName || "",
    vendorId: bill.vendorId || "",
    weight: 0,
  };

  const productRef = doc(db, COLLECTIONS.PRODUCTS, newProduct.id);
  const cleanedProductData = removeUndefined({ ...newProduct, userId });
  batch.set(productRef, await encryptDoc(cleanedProductData));

  // Create inventory transaction record
  const transactionRef = doc(collection(db, COLLECTIONS.INVENTORY));
  const transaction: InventoryTransaction = {
    id: transactionRef.id,
    productId: newProduct.id,
    billId: bill.id,
    type: "purchase" as const,
    quantity: item.quantity,
    date: bill.billDate || bill.createdAt,
    purchasePrice: item.purchasePrice,
    itemNo: item.itemNo || "",
    model: item.model || "",
    imeiNumber: item.imeiNumber || "",
    storage: item.storage || "",
    color: item.color || "",
    vendorId: item.vendorId || bill.vendorId || "",
    vendorName: bill.vendorName || "",
    userId,
  };
  const cleanedTransactionData = removeUndefined(transaction);
  batch.set(transactionRef, await encryptDoc(cleanedTransactionData));

  if (isSerializedTracking(newProduct) || Boolean(item.imeiNumber?.trim()) || Boolean(item.serialNumber?.trim())) {
    await addInventoryUnitForPurchase(batch, userId, item, newProduct, bill, existingUnits);
  }
};

export const isPurchaseBillDuplicate = async (
  billNumber: string,
  vendorName: string,
  excludeId?: string
): Promise<boolean> => {
  try {
    if (!billNumber) return false;
    const bills = await getPurchaseBills();
    return bills.some(
      (b) =>
        b.id !== excludeId &&
        b.billNumber?.toLowerCase() === billNumber.toLowerCase() &&
        b.vendorName.toLowerCase() === vendorName.toLowerCase()
    );
  } catch (error) {
    console.error("Error checking purchase bill duplicate:", error);
    return false;
  }
};

export const isPurchaseBillInventoryAdded = async (
  billId: string
): Promise<boolean> => {
  try {
    const billRef = doc(db, COLLECTIONS.PURCHASE_BILLS, billId);
    const billSnap = await getDoc(billRef);

    if (billSnap.exists()) {
      const bill = await decryptDoc(billSnap.data() as any) as PurchaseBill;
      return bill.itemsAddedToInventory === true;
    }
    return false;
  } catch (error) {
    console.error("Error checking purchase bill inventory status:", error);
    return false;
  }
};

export const updatePurchaseBillOverdueStatus = async (): Promise<void> => {
  try {
    const bills = await getPurchaseBills();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const batch = writeBatch(db);
    let hasChanges = false;

    for (const bill of bills) {
      // Only mark overdue if the bill still has a genuine balance (not paid or overpaid)
      if (bill.paymentStatus !== "paid" && bill.paymentStatus !== "overpaid" && bill.dueDate) {
        const dueDate = new Date(bill.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        if (dueDate < today) {
          const billRef = doc(db, COLLECTIONS.PURCHASE_BILLS, bill.id);
          batch.set(billRef, await encryptDoc(removeUndefined({ ...bill, paymentStatus: "overdue" })));
          hasChanges = true;
        }
      }
    }

    if (hasChanges) {
      await batch.commit();
    }
  } catch (error) {
    console.error("Error updating purchase bill overdue status:", error);
  }
};

export const checkStockAvailability = async (
  productId: string,
  requiredQty: number
): Promise<{ available: boolean; stock: number; productName: string }> => {
  try {
    const productRef = doc(db, COLLECTIONS.PRODUCTS, productId);
    const productSnap = await getDoc(productRef);

    if (!productSnap.exists()) {
      return { available: false, stock: 0, productName: "Unknown Product" };
    }

    const product = await decryptDoc(productSnap.data() as any) as Product;
    const isSerializedProduct = (product.trackingType || "standard") === "serialized";
    const currentStock = isSerializedProduct
      ? (await getAvailableInventoryUnits(productId)).length
      : product.stock || 0;
    const available = currentStock >= requiredQty && currentStock > 0;

    return {
      available,
      stock: currentStock,
      productName: product.name,
    };
  } catch (error) {
    console.error("Error checking stock availability:", error);
    return { available: false, stock: 0, productName: "Unknown Product" };
  }
};

export const validateBillStock = async (
  items: { productId: string; quantity: number }[]
): Promise<{ valid: boolean; errors: string[] }> => {
  try {
    const errors: string[] = [];
    const requiredByProduct = new Map<string, number>();

    for (const item of items) {
      if (item.quantity <= 0) {
        const product = await getDoc(
          doc(db, COLLECTIONS.PRODUCTS, item.productId)
        );
        const productName = product.exists()
          ? (await decryptDoc(product.data() as any) as Product).name
          : "Unknown Product";
        errors.push(`${productName}: Quantity must be greater than 0`);
        continue;
      }
      requiredByProduct.set(
        item.productId,
        (requiredByProduct.get(item.productId) || 0) + item.quantity,
      );
    }

    for (const [productId, requiredQty] of requiredByProduct.entries()) {
      const { available, stock, productName } = await checkStockAvailability(
        productId,
        requiredQty,
      );
      if (!available) {
        errors.push(
          `${productName}: Required ${requiredQty.toFixed(
            2
          )}, Available ${stock.toFixed(2)}`
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  } catch (error) {
    console.error("Error validating bill stock:", error);
    return { valid: false, errors: ["Error validating stock"] };
  }
};

// Bill Returns
export const getBillReturns = async (): Promise<BillReturn[]> => {
  try {
    const userId = getUserId();
    const q = query(
      collection(db, COLLECTIONS.BILL_RETURNS)
    );
    const querySnapshot = await getDocs(q);

    const returns = await Promise.all(querySnapshot.docs.map(async (doc) => await decryptDoc(doc.data() as any) as BillReturn));

    // Sort by createdAt descending in JavaScript (avoids index requirement)
    return returns.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });
  } catch (error) {
    console.error("Error getting bill returns:", error);
    return [];
  }
};

export const getPurchaseReturns = async (): Promise<PurchaseReturn[]> => {
  try {
    const userId = getUserId();
    const q = query(
      collection(db, COLLECTIONS.PURCHASE_RETURNS)
    );
    const querySnapshot = await getDocs(q);

    const returns = await Promise.all(querySnapshot.docs.map(async (doc) => await decryptDoc(doc.data() as any) as PurchaseReturn));

    // Sort by createdAt descending in JavaScript (avoids index requirement)
    return returns.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });
  } catch (error) {
    console.error("Error getting purchase returns:", error);
    return [];
  }
};

export const saveBillReturn = async (billReturn: BillReturn): Promise<void> => {
  // WARNING: This function only writes the return record — it does NOT update stock,
  // inventory transactions, or bill totals. Use processBillReturn() instead for all
  // new sale return flows. This stub exists only for legacy record-only updates.
  console.error("saveBillReturn called — this skips all inventory/stock side effects. Use processBillReturn() instead.");
  try {
    const userId = getUserId();
    const docRef = doc(db, COLLECTIONS.BILL_RETURNS, billReturn.id);
    const cleanedData = removeUndefined({ ...billReturn, userId });
    await setDoc(docRef, await encryptDoc(cleanedData));
  } catch (error) {
    console.error("Error saving bill return:", error);
    throw error;
  }
};

// Deadstock
export const getDeadstock = async (): Promise<DeadstockItem[]> => {
  try {
    const userId = getUserId();
    const q = query(
      collection(db, COLLECTIONS.DEADSTOCK)
    );
    const querySnapshot = await getDocs(q);

    const items = await Promise.all(querySnapshot.docs.map(async (doc) => await decryptDoc(doc.data() as any) as DeadstockItem));

    // Sort by createdAt descending in JavaScript (avoids index requirement)
    return items.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });
  } catch (error) {
    console.error("Error getting deadstock:", error);
    return [];
  }
};

export const saveDeadstockItem = async (item: DeadstockItem): Promise<void> => {
  try {
    const userId = getUserId();
    const docRef = doc(db, COLLECTIONS.DEADSTOCK, item.id);
    const cleanedData = removeUndefined({ ...item, userId });
    await setDoc(docRef, await encryptDoc(cleanedData));
  } catch (error) {
    console.error("Error saving deadstock item:", error);
    throw error;
  }
};

export const processBillReturn = async (
  billId: string,
  returnItems: {
    productId: string;
    productName: string;
    inventoryUnitId?: string;
    imeiNumber?: string;
    serialNumber?: string;
    quantity: number;
    condition: "good" | "bad";
    returnReason?: string;
    costPrice: number;
  }[],
  options?: {
    returnMode?: "full_bill" | "item_wise" | "amount_only";
    customReturnAmount?: number;
    refundPaidAmount?: number;
    collectPaidAmount?: number;
    collectPaymentMethod?: PaymentMethod;
    refundNote?: string;
  },
): Promise<BillReturn> => {
  try {
    const userId = getUserId();
    const billRef = doc(db, COLLECTIONS.BILLS, billId);
    const billSnap = await getDoc(billRef);

    if (!billSnap.exists()) {
      throw new Error("Bill not found");
    }

    const bill = await decryptDoc(billSnap.data() as any) as Bill;
    const returnMode = options?.returnMode || "item_wise";
    const customReturnAmount = roundToTwo(options?.customReturnAmount || 0);
    const refundPaidAmount = roundToTwo(options?.refundPaidAmount || 0);
    const collectPaidAmount = roundToTwo(options?.collectPaidAmount || 0);
    const collectPaymentMethod = options?.collectPaymentMethod || "Cash";
    const refundNote = (options?.refundNote || "").trim();

    if (returnMode === "amount_only" && customReturnAmount <= 0) {
      throw new Error("Return amount must be greater than 0 for amount-only returns.");
    }

    const computeItemWiseReturnValue = () =>
      roundToTwo(
        returnItems.reduce((sum, item) => {
          const matchedBillItem = findMatchedBillItemForReturn(bill, item);
          if (!matchedBillItem || matchedBillItem.quantity <= 0) return sum;
          const perUnitValue =
            (matchedBillItem.amount || 0) / matchedBillItem.quantity;
          return sum + item.quantity * perUnitValue;
        }, 0),
      );

    const totalReturnValue =
      returnMode === "amount_only"
        ? customReturnAmount
        : computeItemWiseReturnValue();
    const returnSnapshot = calculateReturnAdjustedBillSnapshot(
      bill,
      returnMode === "amount_only" ? [] : returnItems,
      returnMode === "amount_only" ? customReturnAmount : 0,
    );

    if (refundPaidAmount < 0) {
      throw new Error("Refund paid amount cannot be negative.");
    }
    if (refundPaidAmount > totalReturnValue) {
      throw new Error("Refund paid amount cannot exceed total return value.");
    }
    if (refundPaidAmount > returnSnapshot.refundableLimit) {
      throw new Error(
        returnSnapshot.refundableLimit > 0
          ? `Refund paid cannot exceed refundable amount of ₹${returnSnapshot.refundableLimit.toFixed(2)}.`
          : "This return only reduces pending amount. No refund is available for this bill.",
      );
    }
    if (collectPaidAmount > returnSnapshot.pendingAfterReturn) {
      throw new Error(
        returnSnapshot.pendingAfterReturn > 0
          ? `Collected amount cannot exceed pending amount of ₹${returnSnapshot.pendingAfterReturn.toFixed(2)}.`
          : "There is no pending amount available to collect after this return.",
      );
    }
    if (totalReturnValue > (bill.total || 0)) {
      throw new Error("Return value cannot be greater than bill value.");
    }

    const billReturn: BillReturn = {
      id: crypto.randomUUID(),
      billId,
      billNumber: bill.billNumber,
      clientName: bill.client?.name ?? "",
      items: returnItems.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        inventoryUnitId: item.inventoryUnitId,
        imeiNumber: item.imeiNumber,
        serialNumber: item.serialNumber,
        quantity: item.quantity,
        condition: item.condition,
        returnReason: item.returnReason,
      })),
      totalReturnValue,
      returnMode,
      refundPaidAmount,
      refundNote: refundNote || undefined,
      returnDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    const batch = writeBatch(db);
    const allUnits = await getInventoryUnits();

    // Process each returned item
    for (const item of returnItems) {
      const normalizedImei = normalizeImeiText(item.imeiNumber);
      const isSerialized = Boolean(item.inventoryUnitId || normalizedImei);

      if (isSerialized && item.quantity !== 1) {
        throw new Error(
          `IMEI/Serial return for ${item.productName} must have quantity 1.`,
        );
      }

      if (item.condition === "good") {
        // Good product - add back to inventory
        const productRef = doc(db, COLLECTIONS.PRODUCTS, item.productId);
        const productSnap = await getDoc(productRef);
        if (productSnap.exists()) {
          const product = await decryptDoc(productSnap.data() as any) as Product;
          const newStock = product.stock + item.quantity;
          // Round to 2 decimal places
          const roundedStock = Math.round(newStock * 100) / 100;
          batch.set(productRef, await encryptDoc(removeUndefined({ ...product, stock: roundedStock })));
        }
      } else {
        // Bad product - add to deadstock
        const deadstockItem: DeadstockItem = {
          id: crypto.randomUUID(),
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          costPrice: item.costPrice,
          billReturnId: billReturn.id,
          reason: item.returnReason || "Damaged/Defective",
          expenseTracked: true,
          createdAt: new Date().toISOString(),
        };
        const deadstockRef = doc(db, COLLECTIONS.DEADSTOCK, deadstockItem.id);
        const cleanedDeadstockData = removeUndefined({
          ...deadstockItem,
          userId,
        });
        batch.set(deadstockRef, await encryptDoc(cleanedDeadstockData));

        const expenseId = `sales-return-bad-${billReturn.id}-${item.inventoryUnitId || normalizeImeiText(item.imeiNumber) || item.productId}`;
        const expenseRef = doc(db, COLLECTIONS.EXPENSES, expenseId);
        const expenseDateIso = new Date().toISOString();
        const expenseDate = expenseDateIso.split("T")[0];
        const expenseTimeDate = new Date(expenseDateIso);
        const expenseTime = Number.isNaN(expenseTimeDate.getTime())
          ? "00:00"
          : expenseTimeDate.toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            });
        const badLossAmount = roundToTwo(item.quantity * item.costPrice);
        const expenseDescription = [
          `Bad product return loss - Bill ${bill.billNumber}`,
          item.productName,
          item.imeiNumber ? `IMEI ${item.imeiNumber}` : "",
          bill.client?.name ? `Client ${bill.client?.name}` : "",
        ]
          .filter(Boolean)
          .join(" - ");
        batch.set(
          expenseRef,
          await encryptDoc(removeUndefined({
            id: expenseId,
            date: expenseDate,
            time: expenseTime,
            amount: badLossAmount,
            description: expenseDescription,
            category: "Sales Return Loss",
            paymentMethod: "Cash" as const,
            createdAt: expenseDateIso,
            userId,
            sourceType: "sales_return_bad_auto",
          })),
        );
      }

      if (isSerialized) {
        const matchedUnit =
          allUnits.find((u) => u.id === item.inventoryUnitId) ||
          allUnits.find(
            (u) =>
              normalizeImeiText(u.imeiNormalized || u.imeiNumber) ===
                normalizedImei && u.soldBillId === billId,
          );

        if (!matchedUnit) {
          throw new Error(
            `Could not find sold IMEI unit for ${item.productName} (${item.imeiNumber || "unknown"}).`,
          );
        }

        const unitRef = doc(db, COLLECTIONS.INVENTORY_UNITS, matchedUnit.id);
        batch.set(unitRef, await encryptDoc(removeUndefined({ ...matchedUnit, status: item.condition === "good" ? "in_stock" : "deadstock", soldBillId: null, soldAt: null, notes: item.returnReason || matchedUnit.notes || "", updatedAt: new Date().toISOString() })));
      }

      // Record inventory transaction
      const transaction: InventoryTransaction = {
        id: crypto.randomUUID(),
        productId: item.productId,
        billId: billId,
        billReturnId: billReturn.id,
        type: "return",
        quantity: item.quantity,
        date: new Date().toISOString(),
        inventoryUnitId: item.inventoryUnitId,
        imeiNumber: item.imeiNumber || "",
        userId,
      };
      const transactionRef = doc(db, COLLECTIONS.INVENTORY, transaction.id);
      const cleanedTransactionData = removeUndefined({
        ...transaction,
        userId,
      });
      batch.set(transactionRef, await encryptDoc(cleanedTransactionData));
    }

    // Save bill return into batch
    const returnRef = doc(db, COLLECTIONS.BILL_RETURNS, billReturn.id);
    const cleanedReturnData = removeUndefined({ ...billReturn, userId });
    batch.set(returnRef, await encryptDoc(cleanedReturnData));

    // Add the bill update to the same batch so all writes are atomic.
    // The bill doc is fetched inside updateBillAfterReturn; passing batchRef
    // means the setDoc is replaced with batchRef.set so it commits together.
    await updateBillAfterReturn(billId, returnItems, {
      customReturnAmount: returnMode === "amount_only" ? customReturnAmount : 0,
      refundPaidAmount,
      collectPaidAmount,
      collectPaymentMethod,
      refundNote,
    }, batch);

    await batch.commit();

    return billReturn;
  } catch (error) {
    console.error("Error processing bill return:", error);
    throw error;
  }
};

export const updateBillAfterReturn = async (
  billId: string,
  returnItems: {
    productId: string;
    quantity: number;
    costPrice: number;
    productName?: string;
    returnReason?: string;
    inventoryUnitId?: string;
    imeiNumber?: string;
  }[],
  options?: {
    customReturnAmount?: number;
    refundPaidAmount?: number;
    collectPaidAmount?: number;
    collectPaymentMethod?: PaymentMethod;
    refundNote?: string;
  },
  batchRef?: WriteBatch,
): Promise<void> => {
  try {
    const billRef = doc(db, COLLECTIONS.BILLS, billId);
    const billSnap = await getDoc(billRef);

    if (!billSnap.exists()) return;

    const bill = await decryptDoc(billSnap.data() as any) as Bill;
    const customReturnAmount = roundToTwo(options?.customReturnAmount || 0);
    const refundPaidAmount = roundToTwo(options?.refundPaidAmount || 0);
    const collectPaidAmount = roundToTwo(options?.collectPaidAmount || 0);
    const collectPaymentMethod = options?.collectPaymentMethod || "Cash";
    const refundNote = (options?.refundNote || "").trim();
    // isItemWise = true when returning specific items; false = amount_only
    const isItemWise = returnItems.length > 0;

    // Update item quantities in the bill (only for item_wise returns)
    const matchedBillItemIds = new Set<number>(); // track which bill items have been matched
    const updatedItems = isItemWise
      ? bill.items
          .map((item, billItemIndex) => {
            // Match return item — serialized items must match by unit/IMEI; standard items match by productId
            const billItemIsSerialized = Boolean((item as any).inventoryUnitId || normalizeImeiText((item as any).imeiNumber));
            const returnItem = returnItems.find((r) => {
              if (matchedBillItemIds.has(billItemIndex)) return false;
              const returnItemIsSerialized = Boolean(r.inventoryUnitId || normalizeImeiText(r.imeiNumber));
              if (billItemIsSerialized || returnItemIsSerialized) {
                // Serialized: must match exactly by unit ID or normalized IMEI
                if (r.inventoryUnitId && (item as any).inventoryUnitId) {
                  return r.inventoryUnitId === (item as any).inventoryUnitId;
                }
                if (normalizeImeiText(r.imeiNumber) && normalizeImeiText((item as any).imeiNumber)) {
                  return normalizeImeiText(r.imeiNumber) === normalizeImeiText((item as any).imeiNumber);
                }
                return false; // Serialized items must not fall back to productId matching
              }
              // Non-serialized: match by productId
              return r.productId === item.productId;
            });
            if (returnItem) {
              matchedBillItemIds.add(billItemIndex); // prevent this bill item from matching again
              const newQuantity = item.quantity - returnItem.quantity;
              const newAmount = roundToTwo(newQuantity * item.ratePerUnit);
              return {
                ...item,
                quantity: newQuantity,
                amount: newAmount,
              };
            }
            return item;
          })
          .filter((item) => item.quantity > 0)
      : [...bill.items];

    // Recalculate bill totals
    // IMPORTANT: For item_wise returns the subtotal is already reduced (quantities reduced),
    // so do NOT deduct return value a second time.
    // For amount_only returns the subtotal is unchanged, so deduct customReturnAmount.
    const subtotal = roundToTwo(
      updatedItems.reduce((sum, item) => sum + item.amount, 0),
    );
    const discount = Math.min(roundToTwo(bill.discount || 0), subtotal);
    const courierCharges = roundToTwo(bill.courierCharges || 0);
    const amountOnlyDeduction = isItemWise ? 0 : customReturnAmount;
    // Recalculate GST proportionally on the post-return subtotal
    let cgst = 0, sgst = 0, totalTax = 0;
    if (bill.isGst && bill.gstRate) {
      const taxableAmount = Math.max(0, subtotal - discount);
      cgst = roundToTwo(taxableAmount * bill.gstRate / 100 / 2);
      sgst = roundToTwo(taxableAmount * bill.gstRate / 100 / 2);
      totalTax = roundToTwo(cgst + sgst);
    }
    const rawTotal = Math.max(
      0,
      roundToTwo(
      subtotal - discount + courierCharges + totalTax - amountOnlyDeduction,
      ),
    );
    // Round off removed per client requirement: total is the exact calculated amount
    const roundedTotal = rawTotal;
    const roundOff = 0;

    const nextPaidAmount = Math.max(
      0,
      roundToTwo((bill.paidAmount || 0) - refundPaidAmount + collectPaidAmount),
    );
    let paymentStatus: Bill["paymentStatus"] = "pending";
    if (nextPaidAmount >= roundedTotal) {
      paymentStatus = nextPaidAmount > roundedTotal ? "overpaid" : "paid";
    } else if (nextPaidAmount > 0) {
      paymentStatus = "partial";
    } else if (bill.dueDate && new Date(bill.dueDate) < new Date()) {
      paymentStatus = "overdue";
    }

    // Track cumulative returned amount for display in bill list
    const prevReturnedAmount = roundToTwo(bill.returnedAmount || 0);
    const thisReturnDeduction = Math.max(0, roundToTwo((bill.total || 0) - roundedTotal));
    const returnedAmount = roundToTwo(prevReturnedAmount + thisReturnDeduction);

    const existingComment = bill.returnComment || "";
    const returnDate = new Date().toISOString();
    const returnInfo = returnItems
      .map((r) => {
        const name = r.productName || "Item";
        const reason = r.returnReason ? ` (Reason: ${r.returnReason})` : "";
        return `${name}: ${r.quantity} returned${reason}`;
      })
      .join("; ");
    const returnComment = existingComment
      ? `${existingComment}\n${new Date(returnDate).toLocaleString("en-IN")}: ${returnInfo}`
      : `${new Date(returnDate).toLocaleString("en-IN")}: ${returnInfo}`;
    const payments = Array.isArray(bill.payments) ? [...bill.payments] : [];
    if (collectPaidAmount > 0) {
      payments.push({
        id: crypto.randomUUID(),
        amount: collectPaidAmount,
        method: collectPaymentMethod,
        date: returnDate,
        note: refundNote || `Collected during return processing`,
      });
    }

    const billUpdateData = await encryptDoc(removeUndefined({
      ...bill,
      items: updatedItems,
      subtotal,
      discount,
      totalTax,
      cgst,
      sgst,
      roundOff,
      total: roundedTotal,
      paidAmount: nextPaidAmount,
      paymentStatus,
      payments,
      paymentType: collectPaidAmount > 0 ? collectPaymentMethod : (bill.paymentType ?? null),
      modeOfPayment:
        collectPaidAmount > 0 ? collectPaymentMethod : (bill.modeOfPayment ?? null),
      returnComment,
      returnedAmount,
      updatedAt: new Date().toISOString(),
    }));
    if (batchRef) {
      batchRef.set(billRef, billUpdateData);
    } else {
      await setDoc(billRef, billUpdateData);
    }
  } catch (error) {
    console.error("Error updating bill after return:", error);
    throw error;
  }
};

export const getBillReturnsByBillId = async (
  billId: string
): Promise<BillReturn[]> => {
  try {
    const returns = await getBillReturns();
    return returns.filter((r) => r.billId === billId);
  } catch (error) {
    console.error("Error getting bill returns by bill ID:", error);
    return [];
  }
};

export const getReturnedQuantity = async (
  billId: string,
  productId: string
): Promise<number> => {
  try {
    const returns = await getBillReturnsByBillId(billId);
    return returns.reduce((sum, ret) => {
      const item = ret.items.find((i) => i.productId === productId);
      return sum + (item?.quantity || 0);
    }, 0);
  } catch (error) {
    console.error("Error getting returned quantity:", error);
    return 0;
  }
};

export const getTotalDeadstockLoss = async (): Promise<number> => {
  try {
    const deadstock = await getDeadstock();
    return deadstock.reduce(
      (sum, item) =>
        sum + (item.expenseTracked ? 0 : item.quantity * item.costPrice),
      0
    );
  } catch (error) {
    console.error("Error getting total deadstock loss:", error);
    return 0;
  }
};

export const getCostOfGoodsSold = async (): Promise<number> => {
  try {
    const bills = await getBills();
    const products = await getProducts();

    let totalCost = 0;
    bills.forEach((bill) => {
      bill.items.forEach((item) => {
        const product = products.find((p) => p.id === item.productId);
        // Use purchasePrice (true cost) if available; fall back to price for legacy data
        const costPrice = product?.purchasePrice ?? product?.price ?? 0;
        totalCost += item.quantity * costPrice;
      });
    });

    return totalCost;
  } catch (error) {
    console.error("Error getting cost of goods sold:", error);
    return 0;
  }
};

// User Preferences (for theme, PWA settings, etc.)
export const getUserPreference = async (
  key: string
): Promise<string | null> => {
  try {
    const userId = getUserId();
    const docRef = doc(db, COLLECTIONS.USER_PREFERENCES, userId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const prefs = docSnap.data();
      return prefs[key] || null;
    }
    return null;
  } catch (error) {
    console.error("Error getting user preference:", error);
    return null;
  }
};

export const setUserPreference = async (
  key: string,
  value: string
): Promise<void> => {
  try {
    const userId = getUserId();
    const docRef = doc(db, COLLECTIONS.USER_PREFERENCES, userId);
    const cleanedData = removeUndefined({ [key]: value, userId });
    await setDoc(docRef, cleanedData, { merge: true });
  } catch (error) {
    console.error("Error setting user preference:", error);
    throw error;
  }
};

// Expenses
export const getExpenses = async (): Promise<Expense[]> => {
  try {
    const userId = getUserId();
    // Fetch without orderBy: encrypted docs lack root-level createdAt, so Firestore's
    // orderBy would silently exclude them. Sort client-side after decryption instead.
    const querySnapshot = await getDocs(collection(db, COLLECTIONS.EXPENSES));

    const expenses = await Promise.all(
      querySnapshot.docs.map(async (doc) => ({
        id: doc.id,
        ...(await decryptDoc(doc.data() as any)),
      } as Expense))
    );

    // Sort by createdAt descending (most recent first), with fallback to date if createdAt is missing
    return expenses.sort((a, b) => {
      const dateA = a.createdAt || a.date || "";
      const dateB = b.createdAt || b.date || "";
      return dateB.localeCompare(dateA);
    });
  } catch (error) {
    console.error("Error getting expenses:", error);
    return [];
  }
};

export const saveExpense = async (expense: Expense): Promise<void> => {
  try {
    const userId = getUserId();
    const docRef = doc(db, COLLECTIONS.EXPENSES, expense.id);
    const expenseData = {
      ...expense,
      userId,
      // Preserve createdAt if it exists, otherwise set it to now
      createdAt: expense.createdAt || new Date().toISOString(),
    };
    const cleanedData = removeUndefined(expenseData);
    await setDoc(docRef, await encryptDoc(cleanedData));

    // Update Expo expenses if expoId is present
    if (expense.expoId) {
      const expoRef = doc(db, COLLECTIONS.EXPOS, expense.expoId);
      const expoSnap = await getDoc(expoRef);
      if (expoSnap.exists()) {
        const expoData = await decryptDoc(expoSnap.data() as any) as Expo;
        await setDoc(expoRef, await encryptDoc(removeUndefined({ ...expoData, expenses: (Number(expoData.expenses) || 0) + Number(expense.amount) })));
      }
    }
  } catch (error) {
    console.error("Error saving expense:", error);
    throw error;
  }
};

export const deleteExpense = async (expenseId: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTIONS.EXPENSES, expenseId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting expense:", error);
    throw error;
  }
};

// File Management
export const uploadFile = async (file: File): Promise<UploadedFile> => {
  try {
    const userId = getUserId();
    const fileId = crypto.randomUUID();
    const timestamp = Date.now();
    
    // Get file extension safely
    const fileNameParts = file.name.split(".");
    const fileExtension = fileNameParts.length > 1 ? fileNameParts.pop() || "" : "";
    
    // Sanitize file name for storage (remove special characters that might cause issues)
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storageFileName = `${timestamp}_${fileId}${fileExtension ? `.${fileExtension}` : ""}`;
    const storagePath = `files/${userId}/${storageFileName}`;

    // Upload file to Firebase Storage
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, file);

    // Get download URL
    const downloadUrl = await getDownloadURL(storageRef);

    // Use the file.name as displayed name (which may be custom)
    const displayName = file.name;

    // Create file record in Firestore
    const uploadedFile: UploadedFile = {
      id: fileId,
      name: displayName,
      originalName: displayName,
      type: file.type || "application/octet-stream",
      size: file.size,
      downloadUrl,
      storagePath,
      uploadedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    const docRef = doc(db, COLLECTIONS.FILES, fileId);
    const cleanedData = removeUndefined({ ...uploadedFile, userId });
    await setDoc(docRef, await encryptDoc(cleanedData));

    return uploadedFile;
  } catch (error) {
    console.error("Error uploading file:", error);
    // Provide more detailed error message
    if (error instanceof Error) {
      throw new Error(`Failed to upload file: ${error.message}`);
    }
    throw new Error("Failed to upload file. Please try again.");
  }
};

export const getFiles = async (): Promise<UploadedFile[]> => {
  try {
    const userId = getUserId();
    const q = query(
      collection(db, COLLECTIONS.FILES)
    );
    const querySnapshot = await getDocs(q);

    const files = await Promise.all(querySnapshot.docs.map(async (doc) => await decryptDoc(doc.data() as any) as UploadedFile));

    // Sort by uploadedAt descending
    return files.sort((a, b) => {
      const dateA = new Date(a.uploadedAt || a.createdAt || 0).getTime();
      const dateB = new Date(b.uploadedAt || b.createdAt || 0).getTime();
      return dateB - dateA;
    });
  } catch (error) {
    console.error("Error getting files:", error);
    return [];
  }
};

export const deleteFile = async (
  fileId: string,
  storagePath: string
): Promise<void> => {
  try {
    // Delete from Firestore
    const docRef = doc(db, COLLECTIONS.FILES, fileId);
    await deleteDoc(docRef);

    // Delete from Storage
    const storageRef = ref(storage, storagePath);
    await deleteObject(storageRef);
  } catch (error) {
    console.error("Error deleting file:", error);
    throw error;
  }
};

export const downloadFile = async (
  downloadUrl: string,
  fileName: string
): Promise<void> => {
  try {
    const response = await fetch(downloadUrl);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Error downloading file:", error);
    throw error;
  }
};

// Notes Management
export const getNotes = async (date?: string): Promise<Note[]> => {
  try {
    const userId = getUserId();
    // Fetch all notes (encrypted docs store date inside _e, not at root) and filter in memory.
    const querySnapshot = await getDocs(collection(db, COLLECTIONS.NOTES));
    const allNotes = await Promise.all(querySnapshot.docs.map(async (doc) => await decryptDoc(doc.data() as any) as Note));
    const notes = date ? allNotes.filter(n => n.date === date) : allNotes;

    // Sort by createdAt descending
    return notes.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });
  } catch (error) {
    console.error("Error getting notes:", error);
    return [];
  }
};

export const getNotesByDate = async (date: string): Promise<Note[]> => {
  return getNotes(date);
};

export const saveNote = async (note: Note): Promise<void> => {
  try {
    const userId = getUserId();
    const docRef = doc(db, COLLECTIONS.NOTES, note.id);
    const noteData = {
      ...note,
      userId,
      updatedAt: new Date().toISOString(),
    };
    const cleanedData = removeUndefined(noteData);
    await setDoc(docRef, await encryptDoc(cleanedData));
  } catch (error) {
    console.error("Error saving note:", error);
    throw error;
  }
};

export const deleteNote = async (noteId: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTIONS.NOTES, noteId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting note:", error);
    throw error;
  }
};

export const updateNoteStatus = async (
  noteId: string,
  isDone: boolean
): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTIONS.NOTES, noteId);
    const snap = await getDoc(docRef);
    const existing = snap.exists() ? await decryptDoc(snap.data() as any) : {};
    await setDoc(docRef, await encryptDoc(removeUndefined({ ...existing, isDone, updatedAt: new Date().toISOString() })));
  } catch (error) {
    console.error("Error updating note status:", error);
    throw error;
  }
};

export const getProductSalesData = async (productId: string) => {
  const allBills = await getBills();

  let totalSoldQty = 0;
  let totalSaleRevenue = 0;

  for (const bill of allBills) {
    for (const item of bill.items) {
      if (item.productId === productId) {
        totalSoldQty += item.quantity;
        totalSaleRevenue += item.quantity * item.ratePerUnit;
      }
    }
  }

  return { totalSoldQty, totalSaleRevenue };
};


const SAMPLE_BILLS_COLLECTION = "sampleBills";
const SAMPLE_BILL_COUNTER_DOC = "sampleBillCounter";

export const getSampleBills = async (): Promise<SampleBill[]> => {
  try {
    const userId = getUserId();
    const q = query(
      collection(db, SAMPLE_BILLS_COLLECTION)
    );
    const querySnapshot = await getDocs(q);

    const bills = await Promise.all(querySnapshot.docs.map(async (doc) => {
      const data = await decryptDoc(doc.data() as any);
      const client = data.client || {};
      return {
        ...data,
        client: {
          ...client,
          billingAddress:
            client.billingAddress || client.address || "",
          shippingAddress: client.shippingAddress || "",
        },
      } as SampleBill;
    }));

    // Sort by createdAt descending
    return bills.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });
  } catch (error) {
    console.error("Error getting sample bills:", error);
    return [];
  }
};

// Get single sample bill by ID
export const getSampleBillById = async (
  id: string
): Promise<SampleBill | null> => {
  try {
    const billRef = doc(db, SAMPLE_BILLS_COLLECTION, id);
    const billSnap = await getDoc(billRef);

    if (billSnap.exists()) {
      const data = await decryptDoc(billSnap.data() as any);
      const client = data.client || {};
      return {
        ...data,
        client: {
          ...client,
          billingAddress:
            client.billingAddress || client.address || "",
          shippingAddress: client.shippingAddress || "",
        },
      } as SampleBill;
    }
    return null;
  } catch (error) {
    console.error("Error getting sample bill:", error);
    return null;
  }
};

// Save sample bill (NO STOCK UPDATES)
export const saveSampleBill = async (bill: SampleBill): Promise<void> => {
  try {
    const userId = getUserId();
    const billRef = doc(db, SAMPLE_BILLS_COLLECTION, bill.id);
    const cleanedBillData = removeUndefined({
      ...bill,
      userId,
      isSample: true,
    });
    await setDoc(billRef, await encryptDoc(cleanedBillData));
  } catch (error) {
    console.error("Error saving sample bill:", error);
    throw error;
  }
};

// Delete sample bill (NO STOCK RESTORATION)
export const deleteSampleBill = async (id: string): Promise<void> => {
  try {
    const billRef = doc(db, SAMPLE_BILLS_COLLECTION, id);
    await deleteDoc(billRef);
  } catch (error) {
    console.error("Error deleting sample bill:", error);
    throw error;
  }
};

// Update sample bill payment
export const updateSampleBillPayment = async (
  billId: string,
  paidAmount: number,
  paymentType: PaymentMethod,
  note?: string
): Promise<void> => {
  try {
    const billRef = doc(db, SAMPLE_BILLS_COLLECTION, billId);
    const billSnap = await getDoc(billRef);

    if (billSnap.exists()) {
      const bill = await decryptDoc(billSnap.data() as any) as SampleBill;
      const newPaidAmount = bill.paidAmount + paidAmount;
      const paymentStatus: SampleBill["paymentStatus"] =
        newPaidAmount > bill.total ? "overpaid" : newPaidAmount >= bill.total ? "paid" : (newPaidAmount > 0 ? "partial" : bill.paymentStatus);

      const newPayment: PaymentTransaction = {
        id: crypto.randomUUID(),
        amount: paidAmount,
        method: paymentType,
        date: new Date().toISOString(),
        note: note,
      };

      const payments = Array.isArray(bill.payments) ? [...bill.payments, newPayment] : [newPayment];

      await setDoc(billRef, await encryptDoc(removeUndefined({ ...bill, paidAmount: newPaidAmount, paymentStatus, paymentType: paymentType, payments: removeUndefined(payments) })));
    }
  } catch (error) {
    console.error("Error updating sample bill payment:", error);
    throw error;
  }
};

// Get sample bill counter
export const getSampleBillCounter = async (): Promise<number> => {
  try {
    const userId = getUserId();
    const counterRef = doc(
      db,
      COLLECTIONS.COUNTERS,
      `${userId}_${SAMPLE_BILL_COUNTER_DOC}`
    );
    const counterSnap = await getDoc(counterRef);

    if (counterSnap.exists()) {
      return counterSnap.data().value || 0;
    }
    return 0;
  } catch (error) {
    console.error("Error getting sample bill counter:", error);
    return 0;
  }
};

// Increment sample bill counter
export const incrementSampleBillCounter = async (): Promise<number> => {
  try {
    const userId = getUserId();
    const counterRef = doc(
      db,
      COLLECTIONS.COUNTERS,
      `${userId}_${SAMPLE_BILL_COUNTER_DOC}`
    );
    const counterSnap = await getDoc(counterRef);

    let newValue = 1;
    if (counterSnap.exists()) {
      newValue = (counterSnap.data().value || 0) + 1;
    }

    await setDoc(counterRef, { value: newValue });
    return newValue;
  } catch (error) {
    console.error("Error incrementing sample bill counter:", error);
    throw error;
  }
};

// ── Party Payments (independent of bills) ─────────────────────────────────────

export const getPartyPayments = async (partyId?: string): Promise<PartyPayment[]> => {
  try {
    const userId = getUserId();
    // Fetch all and filter in memory — encrypted docs store partyId inside _e, not at root.
    const snap = await getDocs(collection(db, COLLECTIONS.PARTY_PAYMENTS));
    const all = await Promise.all(snap.docs.map(async (d) => ({
      id: d.id,
      ...(await decryptDoc(d.data() as any)),
    }))) as PartyPayment[];
    return partyId ? all.filter(p => p.partyId === partyId) : all;
  } catch (error) {
    console.error("Error getting party payments:", error);
    return [];
  }
};

export const savePartyPayment = async (payment: PartyPayment): Promise<void> => {
  try {
    const userId = getUserId();
    const docRef = doc(db, COLLECTIONS.PARTY_PAYMENTS, payment.id);
    await setDoc(docRef, await encryptDoc(removeUndefined({ ...payment, userId })));
  } catch (error) {
    console.error("Error saving party payment:", error);
    throw error;
  }
};

export const deletePartyPayment = async (id: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTIONS.PARTY_PAYMENTS, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting party payment:", error);
    throw error;
  }
};

// ── Vendor → Party Migration (one-time) ───────────────────────────────────────

export const migrateVendorsToParties = async (): Promise<void> => {
  try {
    const userId = getUserId();
    // Get all vendors
    const vendorsSnap = await getDocs(
      collection(db, COLLECTIONS.VENDORS)
    );
    const vendors = await Promise.all(vendorsSnap.docs.map(async (d) => ({ id: d.id, ...(await decryptDoc(d.data() as any)) }))) as Vendor[];

    // Get all existing clients
    const clientsSnap = await getDocs(
      collection(db, COLLECTIONS.CLIENTS)
    );
    const clients = await Promise.all(clientsSnap.docs.map(async (d) => ({ id: d.id, ...(await decryptDoc(d.data() as any)) }))) as Client[];
    const clientNameMap = new Map<string, Client>(
      clients.map((c) => [c.name.toLowerCase().trim(), c])
    );

    // Get all purchase bills
    const billsSnap = await getDocs(
      collection(db, COLLECTIONS.PURCHASE_BILLS)
    );

    const batch = writeBatch(db);
    const newClientIds = new Map<string, string>(); // vendorId → clientId

    for (const vendor of vendors) {
      const existing = clientNameMap.get(vendor.name.toLowerCase().trim());
      let clientId: string;

      if (existing) {
        clientId = existing.id;
      } else {
        // Create new client from vendor
        clientId = vendor.id; // reuse same id to keep it simple
        const newClient: Client & { userId: string } = {
          id: clientId,
          name: vendor.name,
          billingAddress: (vendor as any).address || "",
          phone: vendor.phone || "",
          email: vendor.email || "",
          openingBalance: 0,
          creditLimit: 0,
          createdAt: vendor.createdAt || new Date().toISOString(),
          userId,
        };
        batch.set(doc(db, COLLECTIONS.CLIENTS, clientId), await encryptDoc(removeUndefined(newClient)));
      }
      newClientIds.set(vendor.id, clientId);
    }

    // Update purchase bills that don't have clientId yet
    for (const billDoc of billsSnap.docs) {
      const bill = await decryptDoc(billDoc.data() as any) as PurchaseBill;
      if (!bill.clientId) {
        // Try to match by vendorId first, then by vendorName
        let clientId = bill.vendorId ? newClientIds.get(bill.vendorId) : undefined;
        if (!clientId && bill.vendorName) {
          const matchedClient = clientNameMap.get(bill.vendorName.toLowerCase().trim());
          if (matchedClient) clientId = matchedClient.id;
          // Also check newly created
          if (!clientId) {
            for (const [, cId] of newClientIds) {
              const vendor = vendors.find((v) => v.id === bill.vendorId);
              if (vendor && vendor.name.toLowerCase().trim() === bill.vendorName.toLowerCase().trim()) {
                clientId = cId;
                break;
              }
            }
          }
        }
        if (clientId) {
          batch.set(doc(db, COLLECTIONS.PURCHASE_BILLS, billDoc.id), await encryptDoc(removeUndefined({ ...bill, clientId })));
        }
      }
    }

    await batch.commit();
  } catch (error) {
    console.error("Error migrating vendors to parties:", error);
    // Non-fatal: don't throw
  }
};

// ─── Active Session Management ───────────────────────────────────────────────

const SESSIONS_COLLECTION = "activeSessions";
const MAX_ACTIVE_SESSIONS = 3;
const SESSION_STALE_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface ActiveSession {
  sessionId: string;
  username: string;
  role: string;
  loginTime: number;
  lastActive: number;
}

/** Count currently active (non-stale) sessions. */
export const getActiveSessionCount = async (): Promise<number> => {
  const snapshot = await getDocs(collection(db, SESSIONS_COLLECTION));
  const now = Date.now();
  let count = 0;
  for (const d of snapshot.docs) {
    const s = d.data() as ActiveSession;
    if (now - s.lastActive < SESSION_STALE_MS) count++;
  }
  return count;
};

/** Register a new session in Firestore. */
export const registerSession = async (
  sessionId: string,
  username: string,
  role: string
): Promise<void> => {
  const now = Date.now();
  await setDoc(doc(db, SESSIONS_COLLECTION, sessionId), {
    sessionId,
    username,
    role,
    loginTime: now,
    lastActive: now,
  });
};

/** Remove a session from Firestore on logout. */
export const removeSession = async (sessionId: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, SESSIONS_COLLECTION, sessionId));
  } catch {
    // best-effort
  }
};

/** Refresh lastActive timestamp so the session isn't considered stale. */
export const refreshSession = async (sessionId: string): Promise<void> => {
  try {
    await updateDoc(doc(db, SESSIONS_COLLECTION, sessionId), {
      lastActive: Date.now(),
    });
  } catch {
    // best-effort
  }
};

/** Read encryption config (verifyToken + active flag) — always plain text, never encrypted. */
export const getEncryptionConfig = async (): Promise<{ active: boolean; verifyToken: string } | null> => {
  try {
    const userId = getUserId();
    const snap = await getDoc(doc(db, COLLECTIONS.ENC_META, userId));
    if (snap.exists()) {
      const d = snap.data() as any;
      return { active: !!d.active, verifyToken: d.verifyToken ?? "" };
    }
    // encMeta doesn't exist — may have been set up before this feature was added.
    // Fall back: if a recovery blob exists, encryption was configured → treat as active-locked
    // so the app shows dummy data and prompts for DEK instead of showing empty data.
    const recoverySnap = await getDoc(doc(db, COLLECTIONS.KEY_RECOVERY, userId));
    if (recoverySnap.exists()) {
      return { active: true, verifyToken: "" };
    }
    return null;
  } catch {
    return null;
  }
};

/** Persist encryption config to Firestore — stored as plain text so any fresh browser can restore. */
export const saveEncryptionConfig = async (verifyToken: string, active: boolean): Promise<void> => {
  await setDoc(doc(db, COLLECTIONS.ENC_META, getUserId()), { active, verifyToken });
};

// ── Repair duplicate serial numbers ──────────────────────────────────────────
// Finds all inventory units that share the same serialNumber and re-assigns
// fresh unique SNs to the extras (oldest unit keeps the original SN).
// Also patches the corresponding purchase bill items to stay in sync.
export const repairDuplicateSerialNumbers = async (): Promise<{
  fixed: number;
  log: string[];
}> => {
  const [allUnitsRaw, allBills, profile] = await Promise.all([
    getInventoryUnits(),
    getPurchaseBills(),
    getCompanyProfile(),
  ]);

  const prefix = (profile?.snPrefix as string | undefined) || "";
  const log: string[] = [];

  // Build a map: normalizedSN → InventoryUnit[]
  const snMap = new Map<string, InventoryUnit[]>();
  for (const unit of allUnitsRaw) {
    const sn = unit.serialNumber?.trim();
    if (!sn) continue;
    const key = normalizeImei(sn);
    if (!snMap.has(key)) snMap.set(key, []);
    snMap.get(key)!.push(unit);
  }

  // Collect groups that have > 1 unit (actual duplicates)
  const dupeGroups = [...snMap.entries()].filter(([, units]) => units.length > 1);
  if (dupeGroups.length === 0) {
    log.push("No duplicate serial numbers found.");
    return { fixed: 0, log };
  }
  log.push(`Found ${dupeGroups.length} duplicate SN group(s).`);

  // Count new SNs needed: for each group, keep the oldest → reassign the rest
  let needed = 0;
  for (const [, units] of dupeGroups) needed += units.length - 1;

  // Find current max SN number used
  let maxSn = 0;
  for (const unit of allUnitsRaw) {
    const sn = (unit.serialNumber || "").trim();
    if (prefix && sn.toUpperCase().startsWith(`${prefix.toUpperCase()}-`)) {
      const num = parseInt(sn.slice(prefix.length + 1), 10);
      if (!isNaN(num) && num > maxSn) maxSn = num;
    }
  }

  // Atomically reserve a contiguous range for all new SNs
  const firstNewNum = await incrementSnCounter(needed, maxSn);
  let nextNum = firstNewNum;

  // Accumulate all bill updates in a map (billId → updated items array) so
  // multiple fixes on the same bill are applied together in one write.
  const billItemUpdates = new Map<string, PurchaseBill>();

  // Firestore batch limit is 500 — split into chunks
  const allOps: Array<() => Promise<void>> = [];
  const now = new Date().toISOString();

  for (const [normSn, units] of dupeGroups) {
    // Sort oldest first so we keep the original SN on the earliest unit
    units.sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
    log.push(`SN "${units[0].serialNumber}" has ${units.length} units — keeping oldest, reassigning ${units.length - 1}`);

    for (let i = 1; i < units.length; i++) {
      const unit = units[i];
      const newSn = prefix
        ? `${prefix}-${String(nextNum).padStart(2, "0")}`
        : `SN-${String(nextNum).padStart(2, "0")}`;
      nextNum++;

      log.push(`  Unit ${unit.id} bill=${unit.purchaseBillId || "(none)"}: "${unit.serialNumber}" → "${newSn}"`);

      // Queue inventory unit update
      const unitRef = doc(db, COLLECTIONS.INVENTORY_UNITS, unit.id);
      const updatedUnit = { ...unit, serialNumber: newSn, updatedAt: now };
      allOps.push(async () => {
        const b = writeBatch(db);
        b.set(unitRef, await encryptDoc(removeUndefined(updatedUnit)));
        await b.commit();
      });

      // Patch the purchase bill item that has this unit's IMEI or old SN
      if (unit.purchaseBillId) {
        const bill = billItemUpdates.get(unit.purchaseBillId)
          || allBills.find((b) => b.id === unit.purchaseBillId);
        if (bill) {
          const normUnitImei = normalizeImei(unit.imeiNumber || "");
          const updatedItems = bill.items.map((item) => {
            const itemImei = normalizeImei((item as any).imeiNumber || "");
            const itemSn = normalizeImei((item as any).serialNumber || "");
            const matchByImei = normUnitImei && itemImei === normUnitImei;
            const matchBySn = !normUnitImei && itemSn === normSn;
            if (matchByImei || matchBySn) {
              return { ...item, serialNumber: newSn };
            }
            return item;
          });
          billItemUpdates.set(bill.id, { ...bill, items: updatedItems, updatedAt: now });
        }
      }
    }
  }

  // Queue all bill updates
  for (const [, bill] of billItemUpdates) {
    const billRef = doc(db, COLLECTIONS.PURCHASE_BILLS, bill.id);
    allOps.push(async () => {
      const b = writeBatch(db);
      b.set(billRef, await encryptDoc(removeUndefined(bill)));
      await b.commit();
    });
  }

  // Run all writes sequentially (each is its own small batch to stay under 500-op limit)
  for (const op of allOps) await op();

  log.push(`Done. Reassigned ${needed} serial number(s).`);
  return { fixed: needed, log };
};
