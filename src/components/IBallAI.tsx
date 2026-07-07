import { useState, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Sparkles, X, Send, Loader2, RotateCcw, TrendingUp } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  getBills,
  getPurchaseBills,
  getClients,
  getProducts,
  getExpenses,
  getInventoryUnits,
  getCompanyProfile,
} from "@/lib/storage";
import type {
  Bill,
  PurchaseBill,
  Client,
  Product,
  Expense,
  InventoryUnit,
  CompanyProfile,
} from "@/types";

// ── Sarvam AI config ──────────────────────────────────────────
const SARVAM_KEY = "sk_gazpo1vi_9GnNjxMav1kgc4mB5NryCksx";
const SARVAM_URL = "https://api.sarvam.ai/v1/chat/completions";
const MODEL = "sarvam-105b";

// ── Types ─────────────────────────────────────────────────────
interface Msg {
  id: string;
  role: "user" | "assistant";
  content: string;
  ts: Date;
  error?: boolean;
}

// ── Quick action prompts ───────────────────────────────────────
const QUICK_ACTIONS = [
  { icon: "📊", label: "Today's business summary", prompt: "Give me a complete summary of today's business — sales, purchases, payments received, and key highlights." },
  { icon: "📱", label: "Best selling mobile models", prompt: "Which mobile models are selling the most? Show quantity sold, revenue, average selling price, and profit per model." },
  { icon: "💰", label: "This month's profit & loss", prompt: "What is my profit this month? Break it down: total sales, total purchase cost, total expenses, and net profit. Also show last month for comparison." },
  { icon: "⚠️", label: "Who owes me the most?", prompt: "Which customers have the highest outstanding receivable amount? List top 10 with exact amounts and number of pending bills." },
  { icon: "📦", label: "Inventory & stock alert", prompt: "Which mobile models are running low in stock? What should I reorder urgently based on sales velocity? Also show total stock value." },
  { icon: "📈", label: "6-month business trend", prompt: "Show me the 6-month trend for sales, purchases, and profit. Identify the best and worst month and explain any patterns." },
];

// ── Context builder ────────────────────────────────────────────
function buildContext(
  bills: Bill[],
  pb: PurchaseBill[],
  clients: Client[],
  products: Product[],
  expenses: Expense[],
  iu: InventoryUnit[],
  co: CompanyProfile | null,
): string {
  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const rs = (n: number) => `Rs.${Math.round(n).toLocaleString("en-IN")}`;

  // Today
  const tBills = bills.filter((b) => (b.date || b.createdAt || "").slice(0, 10) === todayKey);
  const tPurch = pb.filter((b) => (b.billDate || b.createdAt || "").slice(0, 10) === todayKey);
  const tExp = expenses.filter((e) => (e.date || "").slice(0, 10) === todayKey);
  const tSalesTotal = tBills.reduce((s, b) => s + (b.total || 0), 0);
  const tPurchTotal = tPurch.reduce((s, b) => s + (b.total || 0), 0);
  const tExpTotal = tExp.reduce((s, e) => s + (e.amount || 0), 0);

  // This month
  const mBills = bills.filter((b) => new Date(b.date || b.createdAt) >= monthStart);
  const mPurch = pb.filter((b) => new Date(b.billDate || b.createdAt) >= monthStart);
  const mExp = expenses.filter((e) => new Date(e.date) >= monthStart);
  const mSales = mBills.reduce((s, b) => s + (b.total || 0), 0);
  const mPurchT = mPurch.reduce((s, b) => s + (b.total || 0), 0);
  const mExpT = mExp.reduce((s, e) => s + (e.amount || 0), 0);
  const mProfit = mSales - mPurchT - mExpT;

  // Last month
  const lmBills = bills.filter((b) => { const d = new Date(b.date || b.createdAt); return d >= lastMonthStart && d <= lastMonthEnd; });
  const lmPurch = pb.filter((b) => { const d = new Date(b.billDate || b.createdAt); return d >= lastMonthStart && d <= lastMonthEnd; });
  const lmExp = expenses.filter((e) => { const d = new Date(e.date); return d >= lastMonthStart && d <= lastMonthEnd; });
  const lmSales = lmBills.reduce((s, b) => s + (b.total || 0), 0);
  const lmPurchT = lmPurch.reduce((s, b) => s + (b.total || 0), 0);
  const lmExpT = lmExp.reduce((s, e) => s + (e.amount || 0), 0);

  // All-time
  const allSales = bills.reduce((s, b) => s + (b.total || 0), 0);
  const allPurch = pb.reduce((s, b) => s + (b.total || 0), 0);
  const allExp = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const totalRec = bills.filter((b) => b.paymentStatus !== "paid").reduce((s, b) => s + Math.max(0, (b.total || 0) - (b.paidAmount || 0)), 0);
  const totalPay = pb.filter((b) => b.paymentStatus !== "paid").reduce((s, b) => s + Math.max(0, (b.total || 0) - (b.paidAmount || 0)), 0);

  // Inventory totals
  const inStock = iu.filter((u) => u.status === "in_stock" || u.status === "reserved").length;
  const sold = iu.filter((u) => u.status === "sold").length;
  const dead = iu.filter((u) => u.status === "deadstock").length;
  const returned = iu.filter((u) => u.status === "returned").length;

  // Stock value
  const stockVal = products.reduce((s, p) => {
    const isSerial = (p.trackingType || "standard") === "serialized";
    const cnt = isSerial
      ? iu.filter((u) => u.productId === p.id && (u.status === "in_stock" || u.status === "reserved")).length
      : Math.max(0, p.stock || 0);
    return s + cnt * (p.purchasePrice || 0);
  }, 0);

  // Bill ID → client name lookup (for sold-to info on IMEI units)
  const billClientMap = new Map<string, string>();
  bills.forEach((b) => { if (b.id) billClientMap.set(b.id, b.client?.name || ""); });

  // ── PRODUCT CATALOG with vendor source and sold-to breakdown ──
  const productCatalog = products
    .map((p) => {
      const isSerial = (p.trackingType || "standard") === "serialized";
      const pUnits = isSerial ? iu.filter((u) => u.productId === p.id) : [];
      const inStockCount = isSerial
        ? pUnits.filter((u) => u.status === "in_stock" || u.status === "reserved").length
        : Math.max(0, p.stock || 0);
      const soldUnitsAll = pUnits.filter((u) => u.status === "sold");
      const soldCount = soldUnitsAll.length;
      const retCount = pUnits.filter((u) => u.status === "returned").length;
      const deadCount = pUnits.filter((u) => u.status === "deadstock").length;
      const totalTracked = pUnits.length;

      const unitProfit = soldUnitsAll.reduce((s, u) => s + ((u.sellingPrice || 0) - (u.purchasePrice || 0)), 0);

      // Vendor breakdown: who we purchased from
      const vendorMap = new Map<string, { count: number; total: number }>();
      pUnits.forEach((u) => {
        const v = u.vendorName || "Unknown";
        if (!vendorMap.has(v)) vendorMap.set(v, { count: 0, total: 0 });
        const e = vendorMap.get(v)!; e.count++; e.total += u.purchasePrice || 0;
      });
      const vendorStr = [...vendorMap.entries()]
        .sort((a, b) => b[1].count - a[1].count)
        .map(([v, s]) => `${v}(${s.count}@avg${rs(s.count > 0 ? Math.round(s.total / s.count) : 0)})`)
        .join(", ");

      // Customer breakdown: who we sold to
      const custMap = new Map<string, { count: number; total: number }>();
      soldUnitsAll.forEach((u) => {
        const cn = (u.soldBillId ? billClientMap.get(u.soldBillId) : "") || "Unknown";
        if (!custMap.has(cn)) custMap.set(cn, { count: 0, total: 0 });
        const e = custMap.get(cn)!; e.count++; e.total += u.sellingPrice || 0;
      });
      const custStr = [...custMap.entries()]
        .sort((a, b) => b[1].count - a[1].count)
        .map(([c, s]) => `${c}(${s.count}@avg${rs(s.count > 0 ? Math.round(s.total / s.count) : 0)})`)
        .join(", ");

      return { name: p.name, model: p.model, storage: p.storage, color: p.color, isSerial, inStockCount, soldCount, retCount, deadCount, totalTracked, unitProfit, buyPrice: p.purchasePrice || 0, sellPrice: p.sellingPrice || (p as any).price || 0, vendorStr, custStr };
    })
    .sort((a, b) => (b.isSerial ? b.totalTracked : b.inStockCount) - (a.isSerial ? a.totalTracked : a.inStockCount));

  const productLines = productCatalog.map((p) => {
    const nm = [p.name, p.model !== p.name ? p.model : null, p.storage, p.color].filter(Boolean).join("|");
    if (p.isSerial) {
      const lines = [`  "${nm}": InStock=${p.inStockCount}, Sold=${p.soldCount}, Ret=${p.retCount}, Dead=${p.deadCount}, BuyPrice=${rs(p.buyPrice)}, SellPrice=${rs(p.sellPrice)}, Profit=${rs(p.unitProfit)}`];
      if (p.vendorStr) lines.push(`    BoughtFrom: ${p.vendorStr}`);
      if (p.custStr) lines.push(`    SoldTo: ${p.custStr}`);
      return lines.join("\n");
    }
    return `  "${nm}": Stock=${p.inStockCount}, BuyPrice=${rs(p.buyPrice)}, SellPrice=${rs(p.sellPrice)}`;
  });

  // ── ALL CLIENTS (compact one-liner each) ──
  const clientBillMap = new Map<string, { sales: number; out: number; cnt: number }>();
  bills.forEach((b) => {
    const id = b.clientId;
    if (!clientBillMap.has(id)) clientBillMap.set(id, { sales: 0, out: 0, cnt: 0 });
    const e = clientBillMap.get(id)!; e.sales += b.total || 0; e.cnt++;
    if (b.paymentStatus !== "paid") e.out += Math.max(0, (b.total || 0) - (b.paidAmount || 0));
  });
  // Sort: clients with bills first (by sales desc), then new clients with no bills
  const clientsSorted = [...clients].sort((a, b) => {
    const sa = clientBillMap.get(a.id)?.sales || 0;
    const sb = clientBillMap.get(b.id)?.sales || 0;
    return sb - sa;
  });
  const clientLines = clientsSorted.map((c) => {
    const st = clientBillMap.get(c.id);
    return `  ${c.name}${c.phone ? `|${c.phone}` : ""}${st ? `|Bills:${st.cnt},Sales:${rs(st.sales)},Due:${rs(st.out)}` : "|Bills:0"}`;
  });

  // Top vendors
  const vm = new Map<string, { bills: number; total: number; paid: number }>();
  pb.forEach((b) => {
    const k = b.vendorName || "Unknown";
    if (!vm.has(k)) vm.set(k, { bills: 0, total: 0, paid: 0 });
    const e = vm.get(k)!; e.bills++; e.total += b.total || 0; e.paid += b.paidAmount || 0;
  });
  const topVendors = [...vm.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 10);

  // 6-month trend
  const trend = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const ms = bills.filter((b) => (b.date || b.createdAt || "").startsWith(k)).reduce((s, b) => s + (b.total || 0), 0);
    const mp = pb.filter((b) => (b.billDate || b.createdAt || "").startsWith(k)).reduce((s, b) => s + (b.total || 0), 0);
    const me = expenses.filter((e) => (e.date || "").startsWith(k)).reduce((s, e) => s + (e.amount || 0), 0);
    return `  ${d.toLocaleString("en-IN", { month: "short", year: "2-digit" })}${i === 5 ? "(cur)" : ""}: S=${rs(ms)},P=${rs(mp)},E=${rs(me)},Net=${rs(ms - mp - me)}`;
  });

  // Expense categories
  const expCat = new Map<string, number>();
  expenses.forEach((e) => { expCat.set(e.category || "Other", (expCat.get(e.category || "Other") || 0) + (e.amount || 0)); });
  const expLines = [...expCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([c, a]) => `  ${c}:${rs(a)}`);

  // ALL SALE BILLS WITH LINE ITEMS — capped to newest 80 to stay within model context
  const SALE_CAP = 80;
  const billsSorted = [...bills].sort((a, b) => (b.date || b.createdAt || "").localeCompare(a.date || a.createdAt || ""));
  const saleBillLines = billsSorted.slice(0, SALE_CAP).map((b) => {
    const dt = (b.date || b.createdAt || "").slice(0, 10);
    const items = (b.items || [])
      .map((i) => `${i.productName}×${i.quantity || 1}@${rs(i.ratePerUnit || Math.round((i.amount || 0) / Math.max(1, i.quantity || 1)))}${i.imeiNumber ? `[${i.imeiNumber}]` : ""}`)
      .join(", ");
    return `  #${b.billNumber}|${b.client?.name || "?"}|${dt}|${rs(b.total || 0)}|${b.paymentStatus}${b.paidAmount > 0 && b.paymentStatus !== "paid" ? `|Paid:${rs(b.paidAmount)}` : ""}${items ? ` → ${items}` : ""}`;
  });
  const saleBillsOmitted = bills.length - Math.min(bills.length, SALE_CAP);

  // ALL PURCHASE BILLS WITH LINE ITEMS — capped to newest 40
  const PURCH_CAP = 40;
  const pbSorted = [...pb].sort((a, b) => (b.billDate || b.createdAt || "").localeCompare(a.billDate || a.createdAt || ""));
  const purchBillLines = pbSorted.slice(0, PURCH_CAP).map((b) => {
    const dt = (b.billDate || b.createdAt || "").slice(0, 10);
    const items = (b.items || [])
      .map((i) => `${i.description}×${i.quantity || 1}@${rs(i.rate || Math.round((i.amount || 0) / Math.max(1, i.quantity || 1)))}${i.imeiNumber ? `[${i.imeiNumber}]` : ""}`)
      .join(", ");
    return `  PB#${b.billNumber || "?"}|${b.vendorName || "?"}|${dt}|${rs(b.total || 0)}|${b.paymentStatus}${items ? ` → ${items}` : ""}`;
  });
  const purchBillsOmitted = pb.length - Math.min(pb.length, PURCH_CAP);

  // ALL INDIVIDUAL IMEI UNITS — capped to newest 200 (most queries are about recent devices)
  const IMEI_CAP = 200;
  const iuSorted = [...iu].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  const iuLines = iuSorted.slice(0, IMEI_CAP).map((u) => {
    const prod = products.find((p) => p.id === u.productId)?.name || u.productName;
    const buyInfo = `${u.vendorName || "?"}@${rs(u.purchasePrice || 0)}`;
    const sellInfo = u.status === "sold" && u.soldBillId
      ? `→${billClientMap.get(u.soldBillId) || "?"}@${rs(u.sellingPrice || 0)}${u.soldAt ? `(${u.soldAt.slice(0, 10)})` : ""}`
      : "";
    return `  IMEI:${u.imeiNumber}|${prod}|${u.status}|${buyInfo}${sellInfo}`;
  });
  const iuOmitted = iu.length - Math.min(iu.length, IMEI_CAP);

  return `=== Maa AI Business Data (${now.toLocaleTimeString("en-IN")}) ===
${now.toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })} | ${co?.name || "Business"}

[TODAY ${todayKey}]
Sales:${tBills.length}bills=${rs(tSalesTotal)} Purchases:${rs(tPurchTotal)} Expenses:${rs(tExpTotal)} Net:${rs(tSalesTotal - tPurchTotal - tExpTotal)}
${tBills.slice(0, 15).map((b) => {
    const items = (b.items || []).map((i) => `${i.productName}×${i.quantity || 1}@${rs(i.ratePerUnit || 0)}`).join(", ");
    return `  ${b.client?.name || "?"}|#${b.billNumber}|${rs(b.total || 0)}|${b.paymentStatus}${items ? ` → ${items}` : ""}`;
  }).join("\n") || "  (no sales today)"}

[THIS MONTH vs LAST MONTH]
${now.toLocaleString("en-IN", { month: "long" })}: Sales=${rs(mSales)}(${mBills.length}bills), Purch=${rs(mPurchT)}, Exp=${rs(mExpT)}, PROFIT=${rs(mProfit)} ${mProfit >= 0 ? "✅" : "❌"}
${lastMonthStart.toLocaleString("en-IN", { month: "long" })}: Sales=${rs(lmSales)}(${lmBills.length}bills), Purch=${rs(lmPurchT)}, Exp=${rs(lmExpT)}, Profit=${rs(lmSales - lmPurchT - lmExpT)}

[ALL-TIME]
Sales:${bills.length}bills=${rs(allSales)} | Purch:${pb.length}bills=${rs(allPurch)} | Exp:${rs(allExp)} | NetProfit:${rs(allSales - allPurch - allExp)}
Receivable(customers owe):${rs(totalRec)} | Payable(you owe):${rs(totalPay)}

[INVENTORY] IMEI:${iu.length}total InStock:${inStock} Sold:${sold} Dead:${dead} Returned:${returned} StockValue:${rs(stockVal)}

[PRODUCT CATALOG — ${products.length} products, EXACT names, vendor & sold-to breakdown]
${productLines.join("\n")}

[ALL CLIENTS — ${clients.length} parties]
${clientLines.join("\n")}

[TOP VENDORS]
${topVendors.map(([n, v], i) => `  ${i + 1}. ${n}: ${v.bills}bills Total=${rs(v.total)} Pending=${rs(v.total - v.paid)}`).join("\n")}

[EXPENSES BY CATEGORY]
${expLines.join("\n")}

[6-MONTH TREND]
${trend.join("\n")}

[SALE BILLS — ${saleBillLines.length} of ${bills.length} shown (newest first${saleBillsOmitted > 0 ? `, ${saleBillsOmitted} older omitted` : ""})]
${saleBillLines.join("\n")}

[PURCHASE BILLS — ${purchBillLines.length} of ${pb.length} shown (newest first${purchBillsOmitted > 0 ? `, ${purchBillsOmitted} older omitted` : ""})]
${purchBillLines.join("\n")}

[IMEI UNITS — ${iuLines.length} of ${iu.length} shown (newest first${iuOmitted > 0 ? `, ${iuOmitted} older omitted` : ""})]
${iuLines.join("\n")}`;
}

// ── Component ─────────────────────────────────────────────────
export function IBallAI() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [ctxLoading, setCtxLoading] = useState(false);
  const ctxRef = useRef<string | null>(null);
  const msgsEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reload context every time panel opens (fresh data)
  useEffect(() => {
    if (!open) return;
    setCtxLoading(true);
    Promise.all([
      getBills(),
      getPurchaseBills(),
      getClients(),
      getProducts(),
      getExpenses(),
      getInventoryUnits(),
      getCompanyProfile(),
    ])
      .then(([bills, pb, clients, products, expenses, iu, co]) => {
        ctxRef.current = buildContext(bills, pb, clients, products, expenses, iu, co);
      })
      .catch(() => {
        ctxRef.current = "Business data unavailable — please answer general questions.";
      })
      .finally(() => setCtxLoading(false));
  }, [open]);

  // Scroll to latest message
  useEffect(() => {
    msgsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, aiLoading]);

  // Focus input on open
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  // Hide on Settings page (after all hooks)
  if (pathname === "/settings") return null;

  const sendMessage = async (text: string) => {
    if (!text.trim() || aiLoading) return;
    setInput("");

    const userMsg: Msg = { id: `u-${Date.now()}`, role: "user", content: text, ts: new Date() };
    setMsgs((prev) => [...prev, userMsg]);
    setAiLoading(true);

    try {
      const systemPrompt = `You are Maa AI — the dedicated intelligent business assistant for a mobile phone shop's inventory and billing management software.

You have real-time access to the business data provided below. Use it to:
- Give sharp, data-driven insights with exact numbers
- Identify trends, risks, and opportunities proactively
- Suggest smart, actionable business decisions
- Answer any question about sales, purchases, inventory, profits, customers, or vendors
- Speak concisely with Indian currency (Rs.) and business context

Always back your analysis with specific numbers. Use **bold** for key figures. Use bullet points for lists. Be insightful, not just informational — tell the owner what the data MEANS for their business.

${ctxRef.current || "Business data is still loading..."}`;

      // Keep last 10 messages for context (5 back-and-forth exchanges)
      const history = msgs.slice(-10).map((m) => ({ role: m.role, content: m.content }));

      const resp = await fetch(SARVAM_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-subscription-key": SARVAM_KEY,
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: systemPrompt },
            ...history,
            { role: "user", content: text },
          ],
          temperature: 0.65,
          top_p: 0.95,
          max_tokens: 1500,
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => resp.statusText);
        throw new Error(`API ${resp.status}: ${errText}`);
      }

      const data = await resp.json();
      const reply =
        data.choices?.[0]?.message?.content ||
        data.message?.content ||
        "I couldn't generate a response. Please try again.";

      setMsgs((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: "assistant", content: reply, ts: new Date() },
      ]);
    } catch (err: any) {
      setMsgs((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: "assistant",
          content: `**Connection Error**\n${err.message || "Failed to reach Maa AI. Please check your connection and try again."}`,
          ts: new Date(),
          error: true,
        },
      ]);
    } finally {
      setAiLoading(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const hasUnread = msgs.length > 0 && !open;

  return (
    <>
      {/* ── Floating trigger button ──────────────────────────── */}
      <button
        onClick={() => setOpen((v) => !v)}
        title="Maa AI"
        className="fixed bottom-[5.5rem] right-2 lg:bottom-5 lg:right-4 z-[55] h-10 w-10 rounded-full flex items-center justify-center shadow-md transition-all duration-200 hover:scale-110 active:scale-95 select-none"
        style={{ background: "linear-gradient(135deg, #7c3aed 0%, #2563eb 100%)" }}
      >
        <Sparkles className="size-4 text-white drop-shadow" />
        {/* Pulse ring */}
        <span
          className="absolute inset-0 rounded-full animate-ping opacity-25 pointer-events-none"
          style={{ background: "linear-gradient(135deg, #7c3aed, #2563eb)" }}
        />
        {/* Unread badge */}
        {hasUnread && (
          <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-red-500 border-2 border-background animate-bounce" />
        )}
      </button>

      {/* ── Chat panel ──────────────────────────────────────── */}
      {open && (
        <div
          className="fixed z-[54] bottom-36 left-2 right-2 lg:bottom-24 lg:left-auto lg:right-8 lg:w-[420px] flex flex-col rounded-2xl border border-border/60 bg-background shadow-2xl shadow-purple-500/10 overflow-hidden animate-in slide-in-from-bottom-4 duration-200"
          style={{ maxHeight: "calc(100dvh - 10rem)", minHeight: "320px" }}
        >
          <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div
              className="flex items-center gap-3 px-4 py-3 border-b shrink-0"
              style={{ background: "linear-gradient(135deg, #7c3aed18, #2563eb18)" }}
            >
              <div
                className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 shadow-md"
                style={{ background: "linear-gradient(135deg, #7c3aed, #2563eb)" }}
              >
                <Sparkles className="size-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-foreground">Maa AI</p>
                  {ctxLoading && <Loader2 className="size-3 animate-spin text-purple-500" />}
                </div>
                <p className="text-[10px] text-muted-foreground truncate">
                  {ctxLoading ? "Loading your business data…" : "Smart business assistant"}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {msgs.length > 0 && (
                  <button
                    onClick={() => setMsgs([])}
                    className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted/50 transition-colors"
                    title="Clear chat"
                  >
                    <RotateCcw className="size-3.5" />
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted/50 transition-colors"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
              {msgs.length === 0 ? (
                /* Welcome + quick actions */
                <div className="space-y-4 py-1">
                  <div className="text-center">
                    <div
                      className="inline-flex h-12 w-12 rounded-2xl items-center justify-center mb-2 shadow"
                      style={{ background: "linear-gradient(135deg, #7c3aed20, #2563eb20)" }}
                    >
                      <TrendingUp className="size-6 text-purple-600 dark:text-purple-400" />
                    </div>
                    <p className="text-sm font-bold">Hi! I'm Maa AI 👋</p>
                    <p className="text-xs text-muted-foreground mt-1 px-4">
                      {ctxLoading
                        ? "Loading your business data, please wait…"
                        : "I have access to all your business data. Ask me anything!"}
                    </p>
                  </div>

                  {!ctxLoading && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
                        Quick Insights
                      </p>
                      {QUICK_ACTIONS.map((qa, i) => (
                        <button
                          key={i}
                          onClick={() => sendMessage(qa.prompt)}
                          className="w-full text-left px-3 py-2.5 rounded-xl text-xs border border-border/50 bg-muted/20 hover:bg-primary/5 hover:border-primary/30 hover:text-primary transition-all duration-150 flex items-center gap-2.5"
                        >
                          <span className="text-base shrink-0">{qa.icon}</span>
                          <span className="font-medium">{qa.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* Message bubbles */
                <>
                  {msgs.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                    >
                      {msg.role === "assistant" && (
                        <div
                          className="h-6 w-6 rounded-lg shrink-0 mt-0.5 flex items-center justify-center"
                          style={{ background: "linear-gradient(135deg, #7c3aed, #2563eb)" }}
                        >
                          <Sparkles className="size-3 text-white" />
                        </div>
                      )}
                      <div
                        className={`max-w-[88%] rounded-2xl px-3 py-2.5 text-xs leading-relaxed ${msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-tr-sm"
                          : msg.error
                            ? "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 rounded-tl-sm"
                            : "bg-muted/70 text-foreground rounded-tl-sm"
                          }`}
                      >
                        {msg.role === "assistant" ? (
                          <div className="prose prose-xs dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_strong]:font-semibold [&_h1]:text-sm [&_h2]:text-xs [&_h3]:text-xs">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {msg.content}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          <span className="whitespace-pre-wrap">{msg.content}</span>
                        )}
                        <p
                          className={`text-[9px] mt-1.5 ${msg.role === "user" ? "text-primary-foreground/60 text-right" : "text-muted-foreground"
                            }`}
                        >
                          {msg.ts.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  ))}

                  {/* Typing indicator */}
                  {aiLoading && (
                    <div className="flex gap-2">
                      <div
                        className="h-6 w-6 rounded-lg shrink-0 flex items-center justify-center"
                        style={{ background: "linear-gradient(135deg, #7c3aed, #2563eb)" }}
                      >
                        <Sparkles className="size-3 text-white" />
                      </div>
                      <div className="bg-muted/70 rounded-2xl rounded-tl-sm px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {[0, 150, 300].map((delay) => (
                            <div
                              key={delay}
                              className="h-1.5 w-1.5 rounded-full bg-purple-500 animate-bounce"
                              style={{ animationDelay: `${delay}ms` }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
              <div ref={msgsEndRef} />
            </div>

            {/* Input bar */}
            <div className="px-3 py-2.5 border-t bg-background/90 backdrop-blur-sm shrink-0">
              <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/20 pl-3 pr-1.5 py-1.5 focus-within:border-purple-400/50 focus-within:ring-1 focus-within:ring-purple-400/20 transition-all">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder={
                    ctxLoading
                      ? "Loading data…"
                      : aiLoading
                        ? "Maa AI is thinking…"
                        : "Ask about your business…"
                  }
                  disabled={aiLoading || ctxLoading}
                  className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground disabled:opacity-50 min-w-0"
                />
                <button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || aiLoading || ctxLoading}
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-white transition-all disabled:opacity-40 hover:scale-105 active:scale-95 shrink-0"
                  style={{ background: "linear-gradient(135deg, #7c3aed, #2563eb)" }}
                >
                  {aiLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                </button>
              </div>
              <p className="text-[9px] text-center text-muted-foreground/40 mt-1.5 select-none">
                Powered by Maa Mobile
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
