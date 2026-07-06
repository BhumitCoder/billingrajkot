import type {
  Bill, Client, Product, PurchaseBill, Expense, BankAccount, BillItem, CompanyProfile,
} from "@/types";

// ── Shared helpers ────────────────────────────────────────────────────────────

const item = (
  productId: string,
  productName: string,
  quantity: number,
  ratePerUnit: number,
): BillItem => ({
  productId,
  productName,
  quantity,
  unit: "Pcs",
  ratePerUnit,
  amount: quantity * ratePerUnit,
});

// ── Clients ───────────────────────────────────────────────────────────────────

export const dummyClients: Client[] = [
  { id: "dc1", name: "Ramesh Mobile Store",    billingAddress: "Shop 12, Main Market, Karol Bagh, Delhi",    phone: "9876543210", createdAt: "2024-09-01" },
  { id: "dc2", name: "Sunita Electronics",      billingAddress: "Plot 5, Nehru Nagar, Jaipur, Rajasthan",    phone: "9988776655", createdAt: "2024-09-10" },
  { id: "dc3", name: "Patel Traders",           billingAddress: "Opp. Bus Stand, Anand, Gujarat",            phone: "9765432109", createdAt: "2024-09-15" },
  { id: "dc4", name: "Krishna Communication",   billingAddress: "MG Road, Nashik, Maharashtra",              phone: "9654321098", createdAt: "2024-10-01" },
  { id: "dc5", name: "Shyam Mobile World",      billingAddress: "Near Civil Hospital, Ludhiana, Punjab",     phone: "9543210987", createdAt: "2024-10-10" },
];

// ── Products ──────────────────────────────────────────────────────────────────

export const dummyProducts: Product[] = [
  {
    id: "dp1", name: "Samsung Galaxy A54",  brand: "Samsung", model: "Galaxy A54",
    storage: "128GB", color: "Black",  unit: "Pcs", price: 28500, purchasePrice: 24500,
    sellingPrice: 28500, stock: 12, weight: 0.2, weightUnit: "kg",
    trackingType: "serialized", whereToBuy: "", createdAt: "2024-09-01",
  },
  {
    id: "dp2", name: "Redmi Note 12",        brand: "Xiaomi",  model: "Redmi Note 12",
    storage: "128GB", color: "Ice Blue", unit: "Pcs", price: 16800, purchasePrice: 14200,
    sellingPrice: 16800, stock: 8,  weight: 0.19, weightUnit: "kg",
    trackingType: "serialized", whereToBuy: "", createdAt: "2024-09-05",
  },
  {
    id: "dp3", name: "Vivo Y56",             brand: "Vivo",    model: "Y56",
    storage: "128GB", color: "Gold",     unit: "Pcs", price: 22000, purchasePrice: 18800,
    sellingPrice: 22000, stock: 6,  weight: 0.19, weightUnit: "kg",
    trackingType: "serialized", whereToBuy: "", createdAt: "2024-09-12",
  },
  {
    id: "dp4", name: "Realme C55",           brand: "Realme",  model: "C55",
    storage: "64GB",  color: "Sunshower", unit: "Pcs", price: 14500, purchasePrice: 12200,
    sellingPrice: 14500, stock: 15, weight: 0.18, weightUnit: "kg",
    trackingType: "serialized", whereToBuy: "", createdAt: "2024-09-20",
  },
  {
    id: "dp5", name: "OPPO A78",             brand: "OPPO",    model: "A78",
    storage: "128GB", color: "Aqua Green", unit: "Pcs", price: 24000, purchasePrice: 20500,
    sellingPrice: 24000, stock: 9,  weight: 0.19, weightUnit: "kg",
    trackingType: "serialized", whereToBuy: "", createdAt: "2024-09-25",
  },
];

// ── Bills (Sales) ─────────────────────────────────────────────────────────────

export const dummyBills: Bill[] = [
  {
    id: "db1", billNumber: "INV-0042", date: "2024-11-18",
    clientId: "dc1", client: dummyClients[0],
    items: [item("dp1", "Samsung Galaxy A54", 2, 28500)],
    subtotal: 57000, roundOff: 0, total: 57000,
    paymentTerms: 0, dueDate: "2024-11-18",
    paymentStatus: "paid", paidAmount: 57000, payments: [],
    createdAt: "2024-11-18", updatedAt: "2024-11-18",
  },
  {
    id: "db2", billNumber: "INV-0043", date: "2024-11-19",
    clientId: "dc2", client: dummyClients[1],
    items: [item("dp2", "Redmi Note 12", 3, 16800)],
    subtotal: 50400, roundOff: 0, total: 50400,
    paymentTerms: 7, dueDate: "2024-11-26",
    paymentStatus: "partial", paidAmount: 25000, payments: [],
    createdAt: "2024-11-19", updatedAt: "2024-11-19",
  },
  {
    id: "db3", billNumber: "INV-0044", date: "2024-11-20",
    clientId: "dc3", client: dummyClients[2],
    items: [item("dp3", "Vivo Y56", 1, 22000)],
    subtotal: 22000, roundOff: 0, total: 22000,
    paymentTerms: 0, dueDate: "2024-11-20",
    paymentStatus: "paid", paidAmount: 22000, payments: [],
    createdAt: "2024-11-20", updatedAt: "2024-11-20",
  },
  {
    id: "db4", billNumber: "INV-0045", date: "2024-11-21",
    clientId: "dc4", client: dummyClients[3],
    items: [item("dp4", "Realme C55", 4, 14500)],
    subtotal: 58000, roundOff: 0, total: 58000,
    paymentTerms: 15, dueDate: "2024-12-06",
    paymentStatus: "pending", paidAmount: 0, payments: [],
    createdAt: "2024-11-21", updatedAt: "2024-11-21",
  },
  {
    id: "db5", billNumber: "INV-0046", date: "2024-11-22",
    clientId: "dc5", client: dummyClients[4],
    items: [item("dp5", "OPPO A78", 2, 24000)],
    subtotal: 48000, roundOff: 0, total: 48000,
    paymentTerms: 0, dueDate: "2024-11-22",
    paymentStatus: "paid", paidAmount: 48000, payments: [],
    createdAt: "2024-11-22", updatedAt: "2024-11-22",
  },
];

// ── Purchase Bills ────────────────────────────────────────────────────────────

export const dummyPurchaseBills: PurchaseBill[] = [
  {
    id: "dpb1", billImage: "", vendorName: "Samsung Distributor India",
    vendorAddress: "Connaught Place, New Delhi",
    billNumber: "PUR-1182", billDate: "2024-11-10", dueDate: "2024-11-25",
    items: [{ productId: "dp1", productName: "Samsung Galaxy A54", quantity: 10, purchasePrice: 24500, total: 245000, unit: "Pcs" }],
    subtotal: 245000, total: 245000,
    paymentStatus: "paid", paidAmount: 245000, payments: [],
    createdAt: "2024-11-10", updatedAt: "2024-11-10",
  },
  {
    id: "dpb2", billImage: "", vendorName: "Xiaomi India Pvt Ltd",
    vendorAddress: "Cyber City, Gurugram, Haryana",
    billNumber: "PUR-1183", billDate: "2024-11-12", dueDate: "2024-11-27",
    items: [{ productId: "dp2", productName: "Redmi Note 12", quantity: 8, purchasePrice: 14200, total: 113600, unit: "Pcs" }],
    subtotal: 113600, total: 113600,
    paymentStatus: "partial", paidAmount: 60000, payments: [],
    createdAt: "2024-11-12", updatedAt: "2024-11-12",
  },
  {
    id: "dpb3", billImage: "", vendorName: "Vivo India Ltd",
    vendorAddress: "Bandra Kurla Complex, Mumbai",
    billNumber: "PUR-1184", billDate: "2024-11-14",
    items: [{ productId: "dp3", productName: "Vivo Y56", quantity: 6, purchasePrice: 18800, total: 112800, unit: "Pcs" }],
    subtotal: 112800, total: 112800,
    paymentStatus: "paid", paidAmount: 112800, payments: [],
    createdAt: "2024-11-14", updatedAt: "2024-11-14",
  },
  {
    id: "dpb4", billImage: "", vendorName: "Realme Distributors",
    vendorAddress: "Salt Lake, Kolkata, WB",
    billNumber: "PUR-1185", billDate: "2024-11-15", dueDate: "2024-12-01",
    items: [{ productId: "dp4", productName: "Realme C55", quantity: 15, purchasePrice: 12200, total: 183000, unit: "Pcs" }],
    subtotal: 183000, total: 183000,
    paymentStatus: "pending", paidAmount: 0, payments: [],
    createdAt: "2024-11-15", updatedAt: "2024-11-15",
  },
  {
    id: "dpb5", billImage: "", vendorName: "OPPO India Electronics",
    vendorAddress: "Whitefield, Bangalore, Karnataka",
    billNumber: "PUR-1186", billDate: "2024-11-16",
    items: [{ productId: "dp5", productName: "OPPO A78", quantity: 9, purchasePrice: 20500, total: 184500, unit: "Pcs" }],
    subtotal: 184500, total: 184500,
    paymentStatus: "paid", paidAmount: 184500, payments: [],
    createdAt: "2024-11-16", updatedAt: "2024-11-16",
  },
];

// ── Expenses ──────────────────────────────────────────────────────────────────

export const dummyExpenses: Expense[] = [
  { id: "de1", date: "2024-11-01", time: "10:00", amount: 25000, description: "Monthly Shop Rent",     category: "Rent",      paymentMethod: "Bank", sourceType: "manual", createdAt: "2024-11-01" },
  { id: "de2", date: "2024-11-05", time: "11:30", amount: 3500,  description: "Electricity Bill",      category: "Utilities", paymentMethod: "Bank", sourceType: "manual", createdAt: "2024-11-05" },
  { id: "de3", date: "2024-11-10", time: "09:00", amount: 18000, description: "Staff Salary - Rahul",  category: "Salary",    paymentMethod: "Cash", sourceType: "manual", createdAt: "2024-11-10" },
  { id: "de4", date: "2024-11-15", time: "14:00", amount: 1200,  description: "Internet & Broadband",  category: "Utilities", paymentMethod: "Bank", sourceType: "manual", createdAt: "2024-11-15" },
  { id: "de5", date: "2024-11-18", time: "16:30", amount: 850,   description: "Packing Material",      category: "Supplies",  paymentMethod: "Cash", sourceType: "manual", createdAt: "2024-11-18" },
];

// ── Bank Accounts ─────────────────────────────────────────────────────────────

export const dummyBankAccounts: BankAccount[] = [
  { id: "dba1", bankName: "State Bank of India", accountHolder: "M/s Mobile Solutions",  accountNumber: "XXXX XXXX 4821", branchAndIFSC: "Karol Bagh | SBIN0001234", isDefault: true  },
  { id: "dba2", bankName: "HDFC Bank",            accountHolder: "M/s Mobile Solutions",  accountNumber: "XXXX XXXX 9043", branchAndIFSC: "Rohini | HDFC0002345", isDefault: false },
];

// ── Passbook entries ──────────────────────────────────────────────────────────

export const dummyPassbookEntries = [
  { id: "dpk1", date: "2024-11-22", type: "sale",     description: "INV-0046 — Shyam Mobile World",  partyName: "Shyam Mobile World",  amount: 48000,  paymentMethod: "Cash",  balance: 48000  },
  { id: "dpk2", date: "2024-11-21", type: "sale",     description: "INV-0045 — Krishna Communication", partyName: "Krishna Communication", amount: 0,   paymentMethod: "—",     balance: 48000  },
  { id: "dpk3", date: "2024-11-18", type: "sale",     description: "INV-0042 — Ramesh Mobile Store",  partyName: "Ramesh Mobile Store", amount: 57000,  paymentMethod: "UPI",   balance: 48000  },
  { id: "dpk4", date: "2024-11-15", type: "expense",  description: "Internet & Broadband",             partyName: "",                    amount: -1200,  paymentMethod: "Bank",  balance: -9000  },
  { id: "dpk5", date: "2024-11-10", type: "expense",  description: "Staff Salary - Rahul",             partyName: "",                    amount: -18000, paymentMethod: "Cash",  balance: -7800  },
];

// ── Company profile ───────────────────────────────────────────────────────────

export const dummyCompanyProfile: CompanyProfile = {
  id: "1",
  name: "Mobile Solutions",
  address: "Shop 4, Karol Bagh Market, New Delhi, Delhi 110005",
  phone: "9812345670",
  email: "contact@mobilesolutions.example",
  logo: "",
  signature: "",
  signatureGst: "",
  upiId: "",
  defaultUnit: "pcs",
  unitOptions: ["pcs"],
  themeColor: "#2563eb",
  defaultNote: "",
  commissionSettings: {
    defaultCommissionRate: 5,
    commissionType: "percentage",
    fixedCommissionAmount: 0,
  },
  expenseCategories: [
    "Marketing", "Utilities", "Rent", "Office Supplies", "Transportation",
    "Communication", "Insurance", "Taxes", "Maintenance", "Miscellaneous",
  ],
  snPrefix: "AM",
  snCounter: 0,
  snAutoGenerate: true,
  logoWidth: 60,
  logoHeight: 60,
  gstin: "07AAACM1234F1Z5",
  state: "Delhi",
};

// ── Dashboard stats ───────────────────────────────────────────────────────────

export const dummyDashboardStats = {
  totalSales:     235400,
  totalPurchases: 839900,
  totalExpenses:   48550,
  netProfit:       93500,
  pendingReceivable: 83400,
  pendingPayable:   113600,
  todaySales:      48000,
  todayExpenses:     850,
};
