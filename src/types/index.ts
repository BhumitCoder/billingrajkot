export interface Expo {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  location?: string;
  status: "active" | "completed" | "upcoming";
  initialStocks: Record<string, number>; // productId -> quantity
  remainingStocks: Record<string, number>; // productId -> quantity
  soldStocks: Record<string, number>; // productId -> quantity
  expenses: number;
  receivableAmount: number;
  receivedAmount: number;
  totalSales: number;
  createdAt: string;
}

export type UserRole = "Admin" | "Employee" | "CA" | "Expo";

export interface BillCreator {
  id: string;
  name: string;
  role: UserRole;
  password?: string;
  type?: "Creator" | "Employee" | "CA" | "Expo"; // Added types
  expoId?: string; // For segmented views
  permissions?: string[]; // Array of paths or keys they can access
  createdAt: string;
}

export interface BankAccount {
  id: string;
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  branchAndIFSC: string;
  upiId?: string;
  isDefault?: boolean;
  openingBalance?: number; // Balance in the account when it was first added to the app
}

export interface CompanyProfile {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  logo?: string;
  signature?: string;   // Non-GST bill signature
  signatureGst?: string; // GST bill signature
  upiId?: string; // Legacy: UPI ID for "Scan & Pay" QR on bills (e.g., name@bank)
  defaultUnit?: string; // Default unit for new products
  unitOptions?: string[]; // Allowed product units
  bankDetails?: {
    accountHolder: string;
    bankName: string;
    accountNumber: string;
    branchAndIFSC: string;
  };
  themeColor: string;
  defaultNote?: string; // Default note for bills
  commissionSettings?: {
    defaultCommissionRate: number; // Default commission percentage
    commissionType: "percentage" | "fixed"; // Commission calculation type
    fixedCommissionAmount?: number; // Fixed commission amount (if type is fixed)
  };
  expenseCategories?: string[]; // Custom expense categories
  billCreators?: string[]; // Names of people who can create bills (legacy)
  snPrefix?: string; // Serial number prefix, e.g. "AM"
  snCounter?: number; // Last used SN counter for current prefix (default 0)
  logoSize?: number; // Legacy: used as fallback if logoWidth/logoHeight not set
  logoWidth?: number; // Logo width in pixels (default 40)
  logoHeight?: number; // Logo height in pixels (default 40)
  snAutoGenerate?: boolean; // Auto-generate SN during purchase (default true)
  gstin?: string; // Company GSTIN (15-char)
  state?: string; // Company state (for GST place of supply)
}

export interface Client {
  id: string;
  name: string;
  billingAddress: string;
  shippingAddress?: string;
  phone?: string;
  email?: string;
  openingBalance?: number; // Always positive amount
  openingBalanceType?: "receivable" | "payable"; // Legacy field; party ledger now treats opening balance as Debit
  creditLimit?: number; // Credit limit for this party
  createdAt: string;
  gstin?: string; // Client GSTIN (optional, for GST invoices)
}

export interface Vendor {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  createdAt: string;
}

export interface Product {
  whereToBuy: string;
  vendorId?: string; // Link to Vendor
  variantKey?: string; // Mobile variant identity: name/model/storage/color/itemNo
  trackingType?: "serialized" | "standard"; // serialized = IMEI based, standard = quantity based
  itemNo?: string;
  brand?: string;
  model?: string;
  imeiNumber?: string;
  storage?: string;
  color?: string;
  weight: number;
  weightUnit?: string;
  id: string;
  name: string;
  barcode?: string; // Added barcode field
  unit: string;
  price: number; // Selling price (legacy support)
  purchasePrice: number; // Cost price from purchase
  sellingPrice: number; // Selling price for bills
  stock: number;
  expoStocks?: Record<string, number>; // Expo-wise stock levels: { [expoId]: quantity }
  createdAt: string;
  absorbedLoss?: number;
  imageUrl?: string;
}

export interface BillItem {
  productId: string;
  inventoryUnitId?: string; // IMEI unit reference for serialized devices
  productName: string;
  itemNo?: string;
  model?: string;
  imeiNumber?: string;
  serialNumber?: string;
  storage?: string;
  color?: string;
  batteryHealth?: string;
  warranty?: string;
  vendorId?: string;
  vendorName?: string;
  purchasePrice?: number;
  quantity: number;
  unit: string;
  ratePerUnit: number;
  amount: number;
}

export type PaymentMethod = "Cash" | "Bank Transfer" | "UPI" | "Cheque" | "Other" | "Advance Adjustment";

export interface PaymentTransaction {
  id: string;
  amount: number;
  method: PaymentMethod;
  date: string;
  note?: string;
  bankAccountId?: string; // Which bank account was used
}

export interface PartyPayment {
  id: string;
  partyId: string;
  amount: number;
  type: "collected" | "sent"; // collected = received from party (sale), sent = paid to party (purchase)
  method: PaymentMethod;
  bankAccountId?: string;
  date: string;
  note?: string;
  createdAt: string;
}

export interface Bill {
  id: string;
  billNumber: string;
  date: string;
  clientId: string;
  client: Client;
  items: BillItem[];
  subtotal: number;
  discount?: number;
  discountType?: "amount" | "percentage";
  courierCharges?: number; // Courier/shipping charges
  otherCharges?: number;
  expenses?: number;
  roundOff: number;
  total: number;
  createdBy?: string;
  expoId?: string; // Track which expo this bill belongs to
  paymentTerms: number;
  dueDate: string;
  paymentStatus: "paid" | "pending" | "overdue" | "overpaid" | "partial";
  paidAmount: number;
  paymentType?: PaymentMethod; // For legacy support/display
  payments: PaymentTransaction[]; // Required field for multiple payments
  returns?: BillReturn[]; // Optional sales return records attached to this bill
  returnedAmount?: number; // Cumulative amount deducted from bill due to returns
  notes?: string;
  returnComment?: string;
  deliveryNote?: string;
  modeOfPayment?: string;
  createdAt: string;
  updatedAt: string;
  originalItems?: BillItem[];
  bankAccountId?: string;
  bankAccount?: BankAccount;
  customerImages?: string[]; // ID photos: [0] = front, [1] = back
  isGst?: boolean; // Is this a GST Tax Invoice?
  gstRate?: number; // GST rate % applied to taxable amount (5 | 12 | 18 | 28)
  cgst?: number; // CGST amount = taxable * gstRate/2 / 100
  sgst?: number; // SGST amount = taxable * gstRate/2 / 100
  totalTax?: number; // Total GST = cgst + sgst
}

export interface SampleBill {
  id: string;
  billNumber: string;
  date: string;
  clientId: string;
  client: Client;
  items: BillItem[];
  subtotal: number;
  discount?: number;
  discountType?: "amount" | "percentage";
  otherCharges?: number;
  roundOff: number;
  total: number;
  createdBy?: string;
  paymentTerms: number;
  dueDate: string;
  paymentStatus: "paid" | "pending" | "overdue" | "overpaid" | "partial";
  paidAmount: number;
  paymentType?: PaymentMethod; // For legacy support/display
  payments: PaymentTransaction[]; // Required field for multiple payments
  notes?: string;
  deliveryNote?: string;
  modeOfPayment?: string;
  createdAt: string;
  updatedAt: string;
  bankAccountId?: string;
  bankAccount?: BankAccount;
  isSample: true; // Flag to identify sample bills
}

export interface InventoryTransaction {
  id: string;
  productId: string;
  billId?: string; // Optional for manual stock additions
  billReturnId?: string;
  type: "sale" | "return" | "purchase" | "purchase_return";
  inventoryUnitId?: string;
  quantity: number;
  date: string;
  purchasePrice?: number;
  sellingPrice?: number;
  itemNo?: string;
  model?: string;
  imeiNumber?: string;
  storage?: string;
  color?: string;
  vendorId?: string;
  vendorName?: string;
  clientId?: string;
  clientName?: string;
  userId: string; // Purchase price for stock additions
}

export type InventoryUnitStatus =
  | "in_stock"
  | "reserved"
  | "sold"
  | "returned"
  | "deadstock"
  | "transferred"
  | "warranty_claim";

export interface InventoryUnit {
  id: string;
  userId: string;
  productId: string;
  productName: string;
  imeiNumber: string;
  imeiNormalized: string;
  serialNumber?: string;
  variantKey?: string;
  itemNo?: string;
  model?: string;
  storage?: string;
  color?: string;
  batteryHealth?: string;
  warranty?: string;
  vendorId?: string;
  vendorName?: string;
  purchaseBillId?: string;
  purchasePrice?: number;
  repairCost?: number;
  sellingPrice?: number;
  status: InventoryUnitStatus;
  soldBillId?: string;
  soldAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// Return types
export interface ReturnItem {
  productId: string;
  productName: string;
  inventoryUnitId?: string;
  imeiNumber?: string;
  serialNumber?: string;
  quantity: number;
  condition: "good" | "bad"; // good = back to inventory, bad = deadstock/loss
  returnReason?: string;
}

export interface BillReturn {
  id: string;
  billId: string;
  billNumber: string;
  clientName: string;
  items: ReturnItem[];
  totalReturnValue: number;
  returnMode?: "full_bill" | "item_wise" | "amount_only";
  refundPaidAmount?: number;
  refundNote?: string;
  returnDate: string;
  createdAt: string;
}

// Deadstock for damaged/bad returns
export interface DeadstockItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  costPrice: number; // This is the loss
  billReturnId: string;
  reason: string;
  expenseTracked?: boolean;
  createdAt: string;
}

// Expense types
export interface Expense {
  id: string;
  date: string;
  time: string;
  amount: number;
  description: string;
  category: string;
  paymentMethod: "Cash" | "Bank";
  bankAccountId?: string;
  expoId?: string; // Track which expo this expense belongs to
  purchaseBillId?: string;
  sourceType?:
    | "purchase_bill_auto"
    | "sales_bill_auto"
    | "sales_return_bad_auto"
    | "manual";
  createdAt: string;
}

export interface InventoryItemInput {
  description: string;
  barcode?: string;
  vendorId?: string;
  itemNo?: string;
  model?: string;
  imeiNumber?: string;
  serialNumber?: string;
  storage?: string;
  color?: string;
  batteryHealth?: string;
  warranty?: string;
  quantity: number;
  unit: string;
  purchasePrice: number;
  sellingPrice: number;
  repairCost?: number;
}

export interface InventoryAddResult {
  added: number;
  updated: number;
  conflicts?: ProductConflict[];
}

export interface ProductConflict {
  item: InventoryItemInput;
  existingProducts?: Product[]; // Multiple potential matches
  conflictType: "name-mismatch" | "potential-duplicate" | "new-item";
}


export interface PurchaseBillItem {
  description: string;
  serialNumber?: string; // Auto-generated SN, e.g. AM-01
  itemNo?: string;
  model?: string;
  imeiNumber?: string;
  storage?: string;
  color?: string;
  batteryHealth?: string;
  warranty?: string;
  quantity: number;
  unit: string;
  rate: number;
  sellingPrice?: number;
  amount: number;
  whereToBuy?: string; // Added to support item-level tracking
  weight?: number; // Added to support item-level tracking
  weightUnit?: string; // Added to support item-level tracking
  hasError?: boolean; // Flag for AI extraction errors
  errorMessage?: string; // Error message from AI
  repairCost?: number;
  repairCostNotes?: string;
}

export interface AIExtractionError {
  field: string;
  message: string;
  severity: "warning" | "error";
  suggestion?: string;
}

export interface PurchaseReturnItem {
  productId?: string;
  inventoryUnitId?: string;
  imeiNumber?: string;
  description: string;
  productName: string; // Ensure this is present
  quantity: number;
  rate: number;
  amount: number;
  condition: "good" | "bad"; // Ensure this is present
}

export interface PurchaseReturn {
  id: string;
  purchaseBillId: string;
  vendorName: string;
  billNumber?: string;
  items: PurchaseReturnItem[];
  totalReturnValue: number;
  returnDate: string;
  notes?: string;
  createdAt: string;
}

export interface PurchaseBill {
  id: string;
  billImage: string; // Base64 or URL of uploaded Image
  vendorImages?: string[]; // Vendor ID photos: [0] = front, [1] = back
  clientId?: string; // Link to unified Party (Client)
  vendorId?: string; // Legacy: Link to Vendor
  vendorName: string;
  vendorAddress?: string;
  billNumber?: string;
  billDate?: string;
  dueDate?: string; // Payment due date
  paymentTerms?: number; // Payment terms in days
  items: PurchaseBillItem[];
  returns?: PurchaseReturn[]; // Track returns
  subtotal: number;
  courierCharges?: number; // Courier/shipping charges
  expenseAmount?: number; // Additional expense
  total: number;
  paymentStatus: "paid" | "pending" | "overdue" | "overpaid" | "partial";
  paidAmount: number;
  payments: PaymentTransaction[];
  notes?: string;
  extractedRawText?: string; // Raw text from AI extraction
  extractionErrors?: AIExtractionError[]; // Errors detected during AI extraction
  itemsAddedToInventory?: boolean; // Track if items were added to inventory
  inventoryAddedAt?: string; // When items were added to inventory
  isInvoice?: boolean; // True when the vendor's original invoice (secondhand purchase) was uploaded
  invoiceFileUrl?: string; // Firebase Storage download URL of the uploaded invoice (image or PDF)
  invoiceStoragePath?: string; // Storage path, used to delete/replace the file
  invoiceFileName?: string; // Original file name, used for downloads
  invoiceFileType?: string; // MIME type of the uploaded invoice file
  createdAt: string;
  updatedAt: string;
}

// E-Way Bill Types
export interface EWayBillDetails {
  modeOfTransport?: "Road" | "Rail" | "Air" | "Ship";
  vehicleType?: string;
  vehicleNumber?: string;
  transporterName?: string;
  approxDistance?: number;
}

// File Management Types
export interface UploadedFile {
  id: string;
  name: string;
  originalName: string;
  type: string;
  size: number;
  downloadUrl: string;
  storagePath: string;
  uploadedAt: string;
  createdAt: string;
}

// Note Types
export interface Note {
  id: string;
  date: string; // Date in YYYY-MM-DD format
  content: string;
  isDone: boolean;
  createdAt: string;
  updatedAt: string;
}
