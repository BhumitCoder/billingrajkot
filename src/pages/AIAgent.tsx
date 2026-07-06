import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Bot,
  User,
  Send,
  Loader2,
  Download,
  Sparkles,
  X,
  ChevronRight,
  Globe,
  Check,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { GrowthAnalysisPDF } from "@/components/GrowthAnalysisPDF";
import { getBusinessDataForAI } from "@/lib/businessDataCollector";
import { AIMessageRenderer } from "@/components/AIMessageRenderer";
import {
  getBills,
  getProducts,
  getPurchaseBills,
  getExpenses,
  getInventoryTransactions,
  getBillReturns,
  getDeadstock,
  getClients,
  getCompanyProfile,
  getNotes,
} from "@/lib/firebaseService";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

export type ReportLanguage = "english" | "hindi" | "gujarati";

interface LanguageOption {
  code: ReportLanguage;
  label: string;
  nativeLabel: string;
  flag: string;
}

interface AnalysisOption {
  key:
    | "business_overview"
    | "address_wise"
    | "monthly"
    | "product_wise"
    | "client_wise"
    | "sales"
    | "purchase"
    | "vendor";
  label: string;
  prompt: string;
}
const LANGUAGES: LanguageOption[] = [
  { code: "english", label: "English", nativeLabel: "English", flag: "EN" },
  { code: "hindi", label: "Hindi", nativeLabel: "Hindi", flag: "HI" },
  { code: "gujarati", label: "Gujarati", nativeLabel: "Gujarati", flag: "GU" },
];
const ANALYSIS_OPTIONS: AnalysisOption[] = [
  {
    key: "business_overview",
    label: "Bussiness overview",
    prompt:
      "Create a full business overview from the provided data.",
  },
  {
    key: "address_wise",
    label: "Address Vise analysis",
    prompt:
      "Create address-wise analysis from the provided data.",
  },
  {
    key: "monthly",
    label: "Monthly analysis",
    prompt:
      "Create month-wise analysis from the provided data.",
  },
  {
    key: "product_wise",
    label: "Product vise analysis",
    prompt:
      "Create product-wise analysis from the provided data.",
  },
  {
    key: "client_wise",
    label: "Client vise analysis",
    prompt:
      "Create client-wise analysis from the provided data.",
  },
  {
    key: "sales",
    label: "Sales Analysis",
    prompt:
      "Create sales analysis from the provided data.",
  },
  {
    key: "purchase",
    label: "Purchase analysis",
    prompt:
      "Create purchase analysis from the provided data.",
  },
  {
    key: "vendor",
    label: "Vendor Analysis",
    prompt:
      "Create vendor-wise analysis from the provided data.",
  },
];
const SARVAM_API_URL = "https://api.sarvam.ai/v1/chat/completions";
const getApiKey = () =>
  import.meta.env.VITE_SARVAM_API_KEY || "sk_cgklaer7_PyVfuZMemeppS9aL53Cvbldg";

// ── Language picker modal ──────────────────────────────────────────────────
function LanguageModal({
  onSelect,
  onClose,
}: {
  onSelect: (lang: ReportLanguage) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<ReportLanguage>("english");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 w-[92vw] max-w-sm mx-4 p-6 animate-in zoom-in-95 fade-in duration-300">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400"
        >
          <X size={16} />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 bg-blue-50 dark:bg-blue-950 rounded-xl">
            <Globe className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-bold text-zinc-900 dark:text-white text-base">
              Report Language
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Choose the language for your Business State Report PDF
            </p>
          </div>
        </div>

        <div className="space-y-2.5 mb-6">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => setSelected(lang.code)}
              className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border-2 transition-all duration-200 ${
                selected === lang.code
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-950/50"
                  : "border-zinc-200 dark:border-zinc-700 hover:border-blue-200 dark:hover:border-zinc-600"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{lang.flag}</span>
                <div className="text-left">
                  <p
                    className={`font-semibold text-sm ${
                      selected === lang.code
                        ? "text-blue-700 dark:text-blue-400"
                        : "text-zinc-800 dark:text-zinc-200"
                    }`}
                  >
                    {lang.label}
                  </p>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {lang.nativeLabel}
                  </p>
                </div>
              </div>
              {selected === lang.code && (
                <div className="h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center">
                  <Check size={12} className="text-white" />
                </div>
              )}
            </button>
          ))}
        </div>

        <Button
          className="w-full h-11 rounded-2xl bg-blue-600 hover:bg-blue-700 font-bold text-sm gap-2"
          onClick={() => onSelect(selected)}
        >
          <FileText size={16} />
          Generate in {LANGUAGES.find((l) => l.code === selected)?.nativeLabel}
        </Button>
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────
export default function AIAgent() {
  const [displayMessages, setDisplayMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzed, setIsAnalyzed] = useState(false);
  const [rawBusinessData, setRawBusinessData] = useState<any>(null);
  const [analysisSourceData, setAnalysisSourceData] = useState<any>(null);
  const [pdfData, setPdfData] = useState<string>("");
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [pdfReady, setPdfReady] = useState(false);
  const [showLangModal, setShowLangModal] = useState(false);
  const [reportLanguage, setReportLanguage] =
    useState<ReportLanguage>("english");
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fullHistoryRef = useRef<Message[]>([]);

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector(
        "[data-radix-scroll-area-viewport]",
      );
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [displayMessages]);

  const getMonthKey = (dateValue?: string) => {
    if (!dateValue) return "unknown";
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return "unknown";
    return date.toISOString().slice(0, 7);
  };

  const summarizeByMonth = (records: any[], dateKey: string, amountKey: string) => {
    const monthMap = new Map<string, number>();
    records.forEach((record) => {
      const key = getMonthKey(record?.[dateKey]);
      const amount = Number(record?.[amountKey] ?? 0);
      monthMap.set(key, (monthMap.get(key) ?? 0) + amount);
    });
    return [...monthMap.entries()]
      .map(([month, total]) => ({ month, total }))
      .sort((a, b) => a.month.localeCompare(b.month));
  };

  const buildOptionDataPayload = (optionKey: AnalysisOption["key"]) => {
    if (!analysisSourceData) return rawBusinessData;

    const { processedData, bills, purchaseBills, expenses, products, clients } =
      analysisSourceData;
    const top = <T,>(arr: T[], count = 40) => arr.slice(0, count);

    if (optionKey === "business_overview") {
      return {
        company: rawBusinessData?.company,
        stats: rawBusinessData?.stats,
        monthlyTrends: top(rawBusinessData?.monthlyTrends ?? [], 24),
        topProducts: top(rawBusinessData?.productAnalytics?.topProductsByRevenue ?? [], 12),
        topClients: top(rawBusinessData?.clientAnalytics?.topClientsByRevenue ?? [], 12),
        summaryNotes: (processedData?.recommendations ?? []).slice(0, 8),
      };
    }

    if (optionKey === "address_wise") {
      const addressMap = new Map<
        string,
        { billCount: number; salesTotal: number; paidTotal: number; pendingTotal: number }
      >();
      bills.forEach((bill: any) => {
        const address =
          bill?.client?.billingAddress ||
          bill?.client?.shippingAddress ||
          "Unknown Address";
        const total = Number(bill?.total ?? 0);
        const paid = Number(bill?.paidAmount ?? 0);
        const entry = addressMap.get(address) ?? {
          billCount: 0,
          salesTotal: 0,
          paidTotal: 0,
          pendingTotal: 0,
        };
        entry.billCount += 1;
        entry.salesTotal += total;
        entry.paidTotal += paid;
        entry.pendingTotal += Math.max(0, total - paid);
        addressMap.set(address, entry);
      });

      return {
        addressSummary: top(
          [...addressMap.entries()]
          .map(([address, values]) => ({ address, ...values }))
          .sort((a, b) => b.salesTotal - a.salesTotal),
          50,
        ),
      };
    }

    if (optionKey === "monthly") {
      return {
        monthlySales: top(summarizeByMonth(bills, "date", "total"), 36),
        monthlyPurchases: top(summarizeByMonth(purchaseBills, "billDate", "total"), 36),
        monthlyExpenses: top(summarizeByMonth(expenses, "date", "amount"), 36),
        monthlyTrends: top(rawBusinessData?.monthlyTrends ?? [], 36),
      };
    }

    if (optionKey === "product_wise") {
      const salesByProduct = new Map<string, { quantity: number; revenue: number }>();
      bills.forEach((bill: any) => {
        (bill?.items ?? []).forEach((item: any) => {
          const name = item?.productName || "Unknown Product";
          const quantity = Number(item?.quantity ?? 0);
          const revenue = Number(item?.amount ?? 0);
          const entry = salesByProduct.get(name) ?? { quantity: 0, revenue: 0 };
          entry.quantity += quantity;
          entry.revenue += revenue;
          salesByProduct.set(name, entry);
        });
      });

      return {
        products: top((products ?? []).map((p: any) => ({
          name: p?.name,
          stock: p?.stock,
          purchasePrice: p?.purchasePrice,
          sellingPrice: p?.sellingPrice,
        })), 80),
        productSales: top(
          [...salesByProduct.entries()]
          .map(([name, values]) => ({ name, ...values }))
          .sort((a, b) => b.revenue - a.revenue),
          80,
        ),
      };
    }

    if (optionKey === "client_wise") {
      const byClient = new Map<
        string,
        { billCount: number; totalSales: number; collected: number; pending: number }
      >();
      bills.forEach((bill: any) => {
        const clientName = bill?.client?.name || "Unknown Client";
        const total = Number(bill?.total ?? 0);
        const paid = Number(bill?.paidAmount ?? 0);
        const entry = byClient.get(clientName) ?? {
          billCount: 0,
          totalSales: 0,
          collected: 0,
          pending: 0,
        };
        entry.billCount += 1;
        entry.totalSales += total;
        entry.collected += paid;
        entry.pending += Math.max(0, total - paid);
        byClient.set(clientName, entry);
      });

      return {
        registeredClients: top((clients ?? []).map((c: any) => ({
          name: c?.name,
          billingAddress: c?.billingAddress,
          phone: c?.phone,
        })), 80),
        clientSalesSummary: top(
          [...byClient.entries()]
          .map(([clientName, values]) => ({ clientName, ...values }))
          .sort((a, b) => b.totalSales - a.totalSales),
          80,
        ),
      };
    }

    if (optionKey === "sales") {
      return {
        salesStats: {
          totalRevenue: rawBusinessData?.stats?.totalRevenue ?? 0,
          totalBills: rawBusinessData?.stats?.totalBills ?? 0,
          pendingAmount: rawBusinessData?.stats?.pendingAmount ?? 0,
          overdueBills: rawBusinessData?.stats?.overdueBills ?? 0,
        },
        recentBills: top((bills ?? [])
          .slice()
          .sort((a: any, b: any) => (b?.date || "").localeCompare(a?.date || ""))
          .slice(0, 30)
          .map((bill: any) => ({
            date: bill?.date,
            client: bill?.client?.name,
            total: bill?.total,
            paidAmount: bill?.paidAmount,
            paymentStatus: bill?.paymentStatus,
          })), 40),
      };
    }

    if (optionKey === "purchase") {
      return {
        purchaseStats: {
          totalPurchases: rawBusinessData?.stats?.totalPurchases ?? 0,
          totalPurchaseBills: rawBusinessData?.stats?.totalPurchaseBills ?? 0,
        },
        recentPurchaseBills: top((purchaseBills ?? [])
          .slice()
          .sort((a: any, b: any) =>
            (b?.billDate || b?.createdAt || "").localeCompare(a?.billDate || a?.createdAt || ""),
          )
          .slice(0, 30)
          .map((bill: any) => ({
            vendorName: bill?.vendorName,
            billDate: bill?.billDate,
            total: bill?.total,
            paidAmount: bill?.paidAmount,
            paymentStatus: bill?.paymentStatus,
          })), 40),
      };
    }

    if (optionKey === "vendor") {
      const byVendor = new Map<
        string,
        { billCount: number; purchaseTotal: number; paidTotal: number; pendingTotal: number }
      >();
      purchaseBills.forEach((bill: any) => {
        const vendorName = bill?.vendorName || "Unknown Vendor";
        const total = Number(bill?.total ?? 0);
        const paid = Number(bill?.paidAmount ?? 0);
        const entry = byVendor.get(vendorName) ?? {
          billCount: 0,
          purchaseTotal: 0,
          paidTotal: 0,
          pendingTotal: 0,
        };
        entry.billCount += 1;
        entry.purchaseTotal += total;
        entry.paidTotal += paid;
        entry.pendingTotal += Math.max(0, total - paid);
        byVendor.set(vendorName, entry);
      });

      return {
        vendorPurchaseSummary: top(
          [...byVendor.entries()]
          .map(([vendorName, values]) => ({ vendorName, ...values }))
          .sort((a, b) => b.purchaseTotal - a.purchaseTotal),
          80,
        ),
      };
    }

    return rawBusinessData;
  };

  const buildOptionPrompt = (option: AnalysisOption) => {
    const sharedRules = `Rules:
- Base your answer ONLY on the provided JSON data.
- If some metric is missing, state "data not available" for that metric.
- Keep the answer practical and action-oriented.
- Use clear headings and bullet points.
- Mention important numbers where possible.`;

    const optionInstructions: Record<AnalysisOption["key"], string> = {
      business_overview: `Task: Business Overview
1. Business health summary (2-3 lines)
2. Key strengths (top 3)
3. Key risks/issues (top 3)
4. Financial snapshot
5. Priority action plan for next 30 days`,
      address_wise: `Task: Address-wise Analysis
1. Top addresses by sales
2. Address-level pending/collection risk
3. Underperforming addresses
4. Opportunity addresses
5. Address-specific action plan`,
      monthly: `Task: Monthly Analysis
1. Month-by-month trend summary
2. Best and worst months (with reasons from data)
3. Revenue vs expense vs purchase pattern
4. Profitability movement
5. Next month improvement plan`,
      product_wise: `Task: Product-wise Analysis
1. Top products by revenue
2. Low-performing products
3. Stock risk and deadstock signals
4. Margin/price insight (if data available)
5. Product-level action plan`,
      client_wise: `Task: Client-wise Analysis
1. Top clients by revenue
2. High pending clients and risk
3. Collection priority list
4. Retention and upsell opportunities
5. Client action plan`,
      sales: `Task: Sales Analysis
1. Sales performance summary
2. Growth/decline trend
3. Collection and overdue risk
4. Pipeline/coverage insight (if possible)
5. 30-day sales execution plan`,
      purchase: `Task: Purchase Analysis
1. Purchase trend summary
2. Cost pressure and potential savings
3. Purchase concentration risk
4. Impact on margin/cashflow
5. Purchase optimization plan`,
      vendor: `Task: Vendor Analysis
1. Top vendors by spend
2. Vendor dependency risk
3. Pending payable risk
4. Reliability and negotiation insight
5. Vendor management action plan`,
    };

    return `${option.prompt}

${optionInstructions[option.key]}

${sharedRules}`;
  };

  const compressPayload = (
    value: any,
    maxArrayItems: number,
    maxObjectKeys: number,
    maxDepth: number,
    depth = 0,
  ): any => {
    if (value === null || value === undefined) return value;
    if (typeof value !== "object") return value;
    if (depth >= maxDepth) {
      if (Array.isArray(value)) return { count: value.length };
      return "[truncated]";
    }

    if (Array.isArray(value)) {
      return value
        .slice(0, maxArrayItems)
        .map((item) =>
          compressPayload(item, maxArrayItems, maxObjectKeys, maxDepth, depth + 1),
        );
    }

    const entries = Object.entries(value).slice(0, maxObjectKeys);
    return Object.fromEntries(
      entries.map(([k, v]) => [
        k,
        compressPayload(v, maxArrayItems, maxObjectKeys, maxDepth, depth + 1),
      ]),
    );
  };

  const buildOptionPromptWithData = (
    option: AnalysisOption,
    optionData: any,
    reductionLevel: number,
  ) => {
    const compressedData =
      reductionLevel === 0
        ? optionData
        : reductionLevel === 1
          ? compressPayload(optionData, 40, 30, 5)
          : reductionLevel === 2
            ? compressPayload(optionData, 20, 20, 4)
            : compressPayload(optionData, 10, 12, 3);

    const promptBase = buildOptionPrompt(option);
    return `${promptBase}

Use only the following filtered business data for this analysis:
${JSON.stringify(compressedData, null, 2)}`;
  };

  const buildRequestMessages = (
    history: Message[],
    currentPrompt: string,
    keepTurns: number,
  ) => {
    const systemMessage = history.find((m) => m.role === "system");
    const convo = history.filter((m) => m.role !== "system");
    const previous = convo.slice(0, Math.max(0, convo.length - 1));
    const recent = previous.slice(-keepTurns * 2);
    const messages: Message[] = [];

    if (systemMessage) messages.push(systemMessage);
    messages.push(...recent);
    messages.push({ role: "user", content: currentPrompt });
    return messages;
  };

  const isContextLimitError = (status: number, errorText: string) => {
    const text = (errorText || "").toLowerCase();
    return (
      status === 413 ||
      status === 414 ||
      text.includes("token") ||
      text.includes("context") ||
      text.includes("maximum") ||
      text.includes("too long") ||
      text.includes("length")
    );
  };

  // ── Auto-analyse on mount ─────────────────────────────────────────────────
  useEffect(() => {
    const autoAnalyse = async () => {
      if (isAnalyzed || isLoading) return;
      setIsLoading(true);
      try {
        const [
          bills,
          products,
          purchaseBills,
          expenses,
          inventoryTransactions,
          billReturns,
          deadstock,
          clients,
          profile,
          notes,
        ] = await Promise.all([
          getBills(),
          getProducts(),
          getPurchaseBills(),
          getExpenses(),
          getInventoryTransactions(),
          getBillReturns(),
          getDeadstock(),
          getClients(),
          getCompanyProfile(),
          getNotes(),
        ]);

        const processedData = await getBusinessDataForAI();
        setAnalysisSourceData({
          processedData,
          bills,
          products,
          purchaseBills,
          expenses,
          inventoryTransactions,
          billReturns,
          deadstock,
          clients,
          profile,
          notes,
        });

        setRawBusinessData({
          stats: {
            totalRevenue: processedData.stats.totalSales,
            totalDiscount: 0,
            totalPurchases: processedData.stats.totalPurchases,
            grossProfit:
              processedData.stats.totalSales -
              processedData.stats.totalPurchases,
            profit: processedData.stats.netProfit,
            totalCOGS: processedData.stats.totalPurchases,
            totalExpenses: processedData.stats.totalExpenses,
            deadstockLoss: 0,
            inventoryValue: processedData.stats.inventoryValue,
            totalProducts: products.length,
            totalReturns: billReturns.length,
            totalBills: bills.length,
            totalPurchaseBills: purchaseBills.length,
            totalClients: clients.length,
            overdueBills: bills.filter((b) => b.paymentStatus === "pending")
              .length,
            pendingAmount:
              processedData.stats.totalSales -
              processedData.stats.totalCollected,
            pendingPurchases: processedData.stats.totalPurchases,
            netGst: processedData.stats.gstLiability,
            gstPaid: 0,
            paidSubtotal: processedData.stats.totalCollected,
            pendingSubtotal:
              processedData.stats.totalSales -
              processedData.stats.totalCollected,
            overdueSubtotal: 0,
          },
          productAnalytics: {
            topProductsByRevenue: (
              processedData.topPerformingProducts || []
            ).map((p: any) => ({
              name: p.name,
              revenue: p.sales,
              quantity: p.stock,
            })),
          },
          clientAnalytics: {
            topClientsByRevenue: (processedData.clientHealth || []).map(
              (c: any) => ({
                name: c.name,
                revenue: c.totalSales,
                pendingAmount: c.pending,
              }),
            ),
          },
          company: profile,
          monthlyTrends: processedData.monthlyTrends || [],
        });

        const systemMessage: Message = {
          role: "system",
          content: `You are a Business Growth AI for billing software users.
Help the user understand their business situation and grow it using simple, clear language.
Use emojis and short sentences. Always respond in the same language the user writes in.`,
        };
        fullHistoryRef.current = [systemMessage];
        setIsAnalyzed(true);
      } catch (error) {
        console.error("Error:", error);
        toast.error("Failed to prepare business analysis data.");
      } finally {
        setIsLoading(false);
      }
    };

    autoAnalyse();
  }, []);

  // ── Generate PDF from chat ────────────────────────────────────────────────
  const generateReport = async (lang: ReportLanguage) => {
    setShowLangModal(false);
    if (isGeneratingPDF || !rawBusinessData) return;

    setReportLanguage(lang);
    setIsGeneratingPDF(true);
    setPdfReady(false);

    const langInstructions: Record<ReportLanguage, string> = {
      english:
        "Write the ENTIRE report — every word, every heading, every sentence — in English only.",
      hindi:
        "पूरी रिपोर्ट केवल हिंदी में लिखें। हर शब्द, हर heading, हर वाक्य हिंदी में होना चाहिए। अंग्रेजी में कुछ भी न लिखें।",
      gujarati:
        "સમગ્ર રિપોર્ટ ફક્ત ગુજરાતીમાં લખો. દરેક શબ્દ, દરેક heading, દરેક વાક્ય ગુજરાતીમાં હોવું જોઈએ. અંગ્રેજીમાં કંઈ ન લખો.",
    };

    try {
      // Build clean English-only chat transcript so JSON output stays reliable
      const chatTranscript = fullHistoryRef.current
        .filter((m) => m.role !== "system")
        .slice(-12)
        .map((m) => {
          const role = m.role === "user" ? "Business Owner" : "AI Advisor";
          // Transliterate: strip emojis and keep the text substance
          const text = m.content.replace(/[\u{1F300}-\u{1FFFF}]/gu, "").trim();
          return `${role}: ${text}`;
        })
        .join("\n\n");

      const stats = rawBusinessData.stats ?? {};
      const company = rawBusinessData.company ?? {};

      const dataSnapshot = `
Business: ${company.name ?? "Unknown"} (${company.type ?? "Retail"})
Total Revenue: Rs.${stats.totalRevenue ?? 0}
Amount Collected: Rs.${stats.paidSubtotal ?? 0}
Pending Receivables: Rs.${stats.pendingSubtotal ?? 0}
Total Purchases: Rs.${stats.totalPurchases ?? 0}
Total Expenses: Rs.${stats.totalExpenses ?? 0}
Net Profit / Loss: Rs.${stats.profit ?? 0}
Inventory Value: Rs.${stats.inventoryValue ?? 0}
Tax Liability: Rs.${stats.netGst ?? 0}
Total Bills: ${stats.totalBills ?? 0}
Total Clients: ${stats.totalClients ?? 0}
Overdue Bills: ${stats.overdueBills ?? 0}
Top Products: ${
        (rawBusinessData.productAnalytics?.topProductsByRevenue ?? [])
          .slice(0, 3)
          .map((p: any) => `${p.name} (Rs.${p.revenue ?? 0})`)
          .join(", ") || "None"
      }
Top Clients: ${
        (rawBusinessData.clientAnalytics?.topClientsByRevenue ?? [])
          .slice(0, 3)
          .map((c: any) => `${c.name} (Rs.${c.revenue ?? 0})`)
          .join(", ") || "None"
      }
      `.trim();

      const messages = [
        {
          role: "system",
          content: `You are a Senior Business Consultant writing a Business State Report.
This report is a formal written summary of what was discussed between a business owner and an AI advisor.

LANGUAGE INSTRUCTION (CRITICAL):
${langInstructions[lang]}

OUTPUT RULES (CRITICAL):
- Output ONLY a valid raw JSON object.
- Absolutely NO markdown fences, NO preamble text, NO explanation outside the JSON.
- Use "Rs." for all currency. Never use the rupee symbol.
- Keep all section headings short (3-5 words max).

JSON structure:
{
  "reportTitle": "Short report title (4-6 words) in chosen language",
  "executiveSummary": "3 paragraphs summarising the business situation discussed in the chat. Cover current health, main issues found, and overall assessment. Min 250 words.",
  "currentState": {
    "heading": "Current Business State (in chosen language, 3-5 words)",
    "points": ["Point 1 based on chat findings", "Point 2", "Point 3", "Point 4", "Point 5"]
  },
  "problemsIdentified": {
    "heading": "Problems Found (in chosen language, 2-4 words)",
    "points": ["Problem 1 from chat", "Problem 2", "Problem 3", "Problem 4"]
  },
  "actionPlan": {
    "heading": "Action Plan (in chosen language, 2-3 words)",
    "steps": ["Step 1 recommended in chat", "Step 2", "Step 3", "Step 4", "Step 5"]
  },
  "financialSummary": "2 paragraphs on financial health based on the data figures and chat discussion. Reference specific numbers.",
  "closingNote": "1 short encouraging closing paragraph in chosen language."
}`,
        },
        {
          role: "user",
          content: `Generate the Business State Report JSON.\n\nBUSINESS FIGURES:\n${dataSnapshot}\n\nCHAT TRANSCRIPT:\n${chatTranscript}`,
        },
      ];

      const response = await fetch(SARVAM_API_URL, {
        method: "POST",
        headers: {
          "api-subscription-key": getApiKey(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "sarvam-m",
          messages,
          temperature: 0.25,
          max_tokens: 3500,
        }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(
          (errBody as any)?.message || `API error ${response.status}`,
        );
      }

      const data = await response.json();
      const raw: string = data?.choices?.[0]?.message?.content ?? "";

      if (!raw.trim()) {
        throw new Error("AI returned an empty response. Please try again.");
      }

      const cleaned = raw
        .trim()
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "");

      JSON.parse(cleaned); // throws if JSON is malformed

      setPdfData(cleaned);
      setPdfReady(true);
      toast.success("Report ready! Click Download to save your PDF.");
    } catch (error: any) {
      console.error("Report Gen Error:", error);
      const msg = error?.message?.includes("empty")
        ? "AI returned empty content — please try again."
        : error instanceof SyntaxError || error?.message?.includes("JSON")
          ? "Report format error — please try again."
          : `Failed to generate: ${error?.message ?? "Unknown error"}`;
      toast.error(msg);
      setPdfReady(false);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // ── Send chat message ─────────────────────────────────────────────────────
  const sendUserPrompt = async (
    visibleText: string,
    actualPrompt?: string,
    optionForRetry?: AnalysisOption,
    optionDataForRetry?: any,
  ) => {
    if (isLoading) return;

    const promptText = (actualPrompt ?? visibleText).trim();
    if (!promptText) return;

    const userMsg: Message = { role: "user", content: visibleText };
    setDisplayMessages((prev) => [...prev, userMsg]);
    fullHistoryRef.current = [
      ...fullHistoryRef.current,
      { role: "user", content: promptText },
    ];
    setIsLoading(true);

    try {
      const historyWindows = [20, 12, 8, 4];
      const maxTokenWindows = [1000, 800, 650, 500];
      let assistantContent = "";
      let lastError = "Message delivery failed.";

      for (let level = 0; level < historyWindows.length; level++) {
        const promptForAttempt =
          optionForRetry && optionDataForRetry
            ? buildOptionPromptWithData(optionForRetry, optionDataForRetry, level)
            : promptText;
        const messagesForAttempt = buildRequestMessages(
          fullHistoryRef.current,
          promptForAttempt,
          historyWindows[level],
        );

        const response = await fetch(SARVAM_API_URL, {
          method: "POST",
          headers: {
            "api-subscription-key": getApiKey(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "sarvam-m",
            messages: messagesForAttempt,
            temperature: 0.7,
            max_tokens: maxTokenWindows[level],
          }),
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          const errText = String((err as any)?.message ?? `API error ${response.status}`);
          lastError = errText;
          if (isContextLimitError(response.status, errText) && level < historyWindows.length - 1) {
            continue;
          }
          throw new Error(errText);
        }

        const data = await response.json();
        assistantContent = String(data?.choices?.[0]?.message?.content ?? "").trim();
        if (assistantContent) {
          fullHistoryRef.current[fullHistoryRef.current.length - 1] = {
            role: "user",
            content: promptForAttempt,
          };
          break;
        }
      }

      if (!assistantContent) {
        throw new Error(lastError || "AI returned empty response.");
      }

      const assistantMessage: Message = {
        role: "assistant",
        content: assistantContent,
      };
      fullHistoryRef.current = [...fullHistoryRef.current, assistantMessage];
      setDisplayMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error("AI message error:", error);
      toast.error(
        error?.message?.includes("token") || error?.message?.includes("context")
          ? "Data was too large; retried with compact context but still failed."
          : "Message delivery failed.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const text = input.trim();
    setInput("");
    await sendUserPrompt(text);
  };

  const handleAnalysisOptionSelect = async (option: AnalysisOption) => {
    const optionData = buildOptionDataPayload(option.key);
    const contextualPrompt = buildOptionPromptWithData(option, optionData, 0);
    await sendUserPrompt(option.label, contextualPrompt, option, optionData);
  };

  const handleCustomOptionSelect = () => {
    inputRef.current?.focus();
  };

  const currentLang = LANGUAGES.find((l) => l.code === reportLanguage);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {showLangModal && (
        <LanguageModal
          onSelect={generateReport}
          onClose={() => setShowLangModal(false)}
        />
      )}

      <div className="flex h-full min-h-0 w-full flex-col gap-3 overflow-hidden">
        {/* ── Header ──────────────────────────────────────────── */}
        <div className="sticky top-0 z-20 shrink-0 rounded-2xl border border-border/70 bg-gradient-to-br from-background via-background to-slate-50/40 p-3 shadow-sm sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center justify-start gap-3 sm:gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => window.history.back()}
              className="md:hidden"
            >
              <ChevronRight className="rotate-180" />
            </Button>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-border">
              <Bot className="h-5 w-5" />
            </div>
            <div className="min-w-0 text-left">
              <h2 className="truncate text-2xl font-semibold leading-tight sm:text-3xl text-foreground">
                Business Growth AI
              </h2>
              <div className="mt-0.5 flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Online & Ready
                </p>
              </div>
            </div>
          </div>

          {isAnalyzed && rawBusinessData && (
            <div className="grid w-full grid-cols-1 gap-2 rounded-xl border border-border/70 bg-muted/30 p-2 lg:w-auto">
            <div className="flex items-center gap-2">
              {!pdfReady ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => !isGeneratingPDF && setShowLangModal(true)}
                  disabled={isGeneratingPDF}
                  className="h-9 gap-2 rounded-full"
                >
                  {isGeneratingPDF ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  <span className="font-bold text-[11px] uppercase tracking-wider">
                    {isGeneratingPDF ? "Generating..." : "Get State Report"}
                  </span>
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  {/* Language switcher pill */}
                  <button
                    onClick={() => {
                      setPdfReady(false);
                      setShowLangModal(true);
                    }}
                    className="flex h-9 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Globe size={13} />
                    {currentLang?.flag} {currentLang?.label}
                    <span className="text-border">.</span>{" "}
                    <span className="text-[10px] text-primary">Change</span>
                  </button>

                  {/* Download */}
                  <PDFDownloadLink
                    document={
                      <GrowthAnalysisPDF
                        summary={pdfData}
                        companyName={rawBusinessData.company?.name}
                        language={reportLanguage}
                      />
                    }
                    fileName={`Business_Report_${currentLang?.label}_${new Date().toISOString().split("T")[0]}.pdf`}
                  >
                    {({ loading }) => (
                      <Button
                        variant="default"
                        size="sm"
                        className="h-9 gap-2 rounded-full"
                        disabled={loading}
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span className="font-bold text-[11px] uppercase tracking-wider">
                          {loading ? "Preparing..." : "Download PDF"}
                        </span>
                      </Button>
                    )}
                  </PDFDownloadLink>
                </div>
              )}

           
            </div>
            </div>
          )}
          </div>
        </div>

        {/* ── Chat area ───────────────────────────────────────── */}
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-b from-muted/20 to-background">
          <ScrollArea
            ref={scrollAreaRef}
            className="h-full px-3 py-4 md:px-5 md:py-5"
          >
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 pb-4">
              {displayMessages.length === 0 && isLoading && (
                <div className="flex min-h-[52vh] flex-col items-center justify-center gap-4 animate-in fade-in duration-300">
                  <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-border bg-card">
                    <Sparkles className="h-8 w-8 animate-pulse text-primary" />
                  </div>
                  <div className="space-y-2 text-center">
                    <h3 className="text-xl font-semibold text-foreground">
                      Checking Your Business...
                    </h3>
                    <p className="mx-auto max-w-xs text-sm text-muted-foreground">
                      Looking at your sales and stock to help you grow.
                    </p>
                  </div>
                </div>
              )}

              {displayMessages
                .filter((m) => m.role !== "system")
                .map((msg, i) =>
                  msg.role === "assistant" ? (
                    <AIMessageRenderer key={i} content={msg.content} />
                  ) : (
                    <div
                      key={i}
                      className="flex justify-end animate-in slide-in-from-bottom-2 duration-300"
                    >
                      <div className="flex max-w-[88%] items-end gap-2 md:max-w-[72%]">
                        <div className="rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm font-medium leading-relaxed text-primary-foreground shadow-sm">
                          {msg.content}
                        </div>
                        <div className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                          <User size={14} />
                        </div>
                      </div>
                    </div>
                  ),
                )}

              {isLoading && displayMessages.length > 0 && (
                <div className="flex justify-start animate-in fade-in duration-200">
                  <div className="flex items-end gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-primary">
                      <Loader2 size={14} className="animate-spin" />
                    </div>
                    <div className="rounded-2xl rounded-tl-md border border-border bg-card px-4 py-3 shadow-sm">
                      <div className="flex gap-1">
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/50" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/50 [animation-delay:150ms]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/50 [animation-delay:300ms]" />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* ── Input bar ──────────────────────────────────────── */}
          {isAnalyzed && (
            <div className="border-t border-border bg-background/95 px-3 py-3 backdrop-blur md:px-5">
              <div className="mx-auto w-full max-w-4xl">
                <div className="mb-3 rounded-xl border border-border bg-card p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Quick Analysis Options
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {ANALYSIS_OPTIONS.map((option) => (
                      <Button
                        key={option.label}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-full px-3 text-xs"
                        onClick={() => handleAnalysisOptionSelect(option)}
                        disabled={isLoading}
                      >
                        {option.label}
                      </Button>
                    ))}
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-8 rounded-full px-3 text-xs"
                      onClick={handleCustomOptionSelect}
                      disabled={isLoading}
                    >
                      Custom
                    </Button>
                  </div>
                </div>
                <form
                  onSubmit={handleSendMessage}
                  className="flex items-center gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm focus-within:ring-2 focus-within:ring-primary/20"
                >
                  <div className="flex-1 px-2">
                    <input
                      ref={inputRef}
                      placeholder="Ask about revenue, expenses, stock, clients, and growth..."
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      disabled={isLoading}
                      className="w-full bg-transparent py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                    />
                  </div>
                  <Button
                    type="submit"
                    size="icon"
                    className="h-10 w-10 rounded-xl"
                    disabled={isLoading || !input.trim()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
                <p className="mt-2 text-center text-[10px] uppercase tracking-wide text-muted-foreground">
                  Chat first, then generate your business state report
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}







