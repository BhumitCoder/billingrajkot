import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ChevronDown, ChevronUp, ExternalLink, Phone, AlertCircle, X } from "lucide-react";
import {
  getBills, getClients, getPurchaseBills,
  getBillReturns, getPurchaseReturns, getPartyPayments,
} from "@/lib/firebaseService";
import type { Bill, Client } from "@/types";

const DAILY_KEY = "overdueDailyCheck";
const todayStr = () => new Date().toISOString().split("T")[0];

export function shouldShowOverdueToday() { return localStorage.getItem(DAILY_KEY) !== todayStr(); }
export function markOverdueCheckedToday() { localStorage.setItem(DAILY_KEY, todayStr()); }

interface PartyOverdue { client: Client; bills: Bill[]; totalOverdue: number; }

const WhatsAppIcon = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.115.549 4.099 1.516 5.834L0 24l6.335-1.648A11.935 11.935 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818c-1.875 0-3.62-.5-5.128-1.375l-.368-.217-3.756.977 1.002-3.643-.24-.378A9.812 9.812 0 012.182 12C2.182 6.59 6.59 2.182 12 2.182S21.818 6.59 21.818 12 17.41 21.818 12 21.818z"/>
  </svg>
);

const fmt = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const fmtDate = (s: string) => s ? new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const daysSince = (s: string) => s ? Math.max(0, Math.floor((Date.now() - new Date(s).getTime()) / 86400000)) : 0;
const waUrl = (phone: string, msg: string) => {
  const d = phone.replace(/\D/g, "");
  return `https://wa.me/${d.startsWith("91") && d.length === 12 ? d : "91" + d}?text=${encodeURIComponent(msg)}`;
};
const billLink = (id: string) => `${window.location.origin}/view/bill/${id}`;

export function OverdueBillsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [data, setData] = useState<PartyOverdue[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => { if (open) load(); }, [open]);

  const load = async () => {
    setLoading(true);
    try {
      const [allSales, allPur, allSR, allPR, allPay, clients] = await Promise.all([
        getBills(), getPurchaseBills(), getBillReturns(),
        getPurchaseReturns(), getPartyPayments(), getClients(),
      ]);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const odIds = new Set<string>();
      const odBills = new Map<string, Bill[]>();
      allSales.forEach((b) => {
        if (!b.clientId || b.paymentStatus === "paid" || b.paymentStatus === "overpaid") return;
        if (b.paymentStatus !== "overdue" && !(b.dueDate && new Date(b.dueDate) < today)) return;
        odIds.add(b.clientId);
        odBills.set(b.clientId, [...(odBills.get(b.clientId) || []), b]);
      });
      const result: PartyOverdue[] = [];
      clients.forEach((c) => {
        if (!odIds.has(c.id)) return;
        const sb = allSales.filter((b) => b.clientId === c.id);
        const pb = allPur.filter((b) => b.clientId === c.id || b.vendorName === c.name);
        const sbIds = sb.map((b) => b.id), pbIds = pb.map((b) => b.id);
        const srv = allSR.filter((r) => sbIds.includes(r.billId)).reduce((s, r) => s + r.totalReturnValue, 0);
        const prv = allPR.filter((r) => pbIds.includes(r.purchaseBillId)).reduce((s, r) => s + r.totalReturnValue, 0);
        const cp = allPay.filter((p) => p.partyId === c.id);
        const col = sb.reduce((s, b) => s + (b.paidAmount || 0), 0) + cp.filter((p) => p.type === "received").reduce((s, p) => s + p.amount, 0);
        const sent = pb.reduce((s, b) => s + (b.paidAmount || 0), 0) + cp.filter((p) => p.type === "sent").reduce((s, p) => s + p.amount, 0);
        const ts = sb.reduce((s, b) => s + b.total + (b.returnedAmount || 0), 0);
        const tp = pb.reduce((s, b) => s + b.total, 0);
        const openAmt = Math.abs(c.openingBalance || 0);
        const isPay = (c.openingBalanceType || "receivable") === "payable";
        const gr = (isPay ? 0 : openAmt) + Math.max(0, ts - srv - col);
        const gp = (isPay ? openAmt : 0) + Math.max(0, tp - prv - sent);
        const net = Math.max(0, gr - gp);
        if (net > 0) result.push({ client: c, bills: odBills.get(c.id)!, totalOverdue: net });
      });
      result.sort((a, b) => b.totalOverdue - a.totalOverdue);
      setData(result);
    } finally { setLoading(false); }
  };

  const close = () => { markOverdueCheckedToday(); onClose(); };

  const waParty = (po: PartyOverdue) => {
    if (!po.client.phone) return;
    const lines = po.bills.map((b) =>
      `• Bill #${b.billNumber} — ${fmt(Math.max(0, (b.total || 0) - (b.paidAmount || 0)))} (due ${fmtDate(b.dueDate)})\n  ${billLink(b.id)}`
    ).join("\n\n");
    window.open(waUrl(po.client.phone, `Dear ${po.client.name},\n\nThis is a gentle reminder that the following payment(s) are overdue:\n\n${lines}\n\nTotal Due: ${fmt(po.totalOverdue)}\n\nKindly clear the dues at your earliest convenience.\n\nThank you.`), "_blank");
  };

  const waBill = (c: Client, b: Bill) => {
    if (!c.phone) return;
    const due = Math.max(0, (b.total || 0) - (b.paidAmount || 0));
    window.open(waUrl(c.phone, `Dear ${c.name},\n\nYour payment of ${fmt(due)} for Bill #${b.billNumber} was due on ${fmtDate(b.dueDate)}.\n\nView Bill: ${billLink(b.id)}\n\nKindly make the payment at the earliest.\n\nThank you.`), "_blank");
  };

  const total = data.reduce((s, p) => s + p.totalOverdue, 0);
  const totalBills = data.reduce((s, p) => s + p.bills.length, 0);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="max-w-2xl w-[96vw] p-0 gap-0 overflow-hidden rounded-xl shadow-xl [&>button]:hidden">
        <DialogTitle className="sr-only">Overdue Collections</DialogTitle>

        {/* ── Header ── */}
        <div className="flex items-center justify-between border-b px-5 py-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
            <div>
              <h2 className="font-semibold text-sm text-foreground leading-tight">Overdue Collections</h2>
              <p className="text-[11px] text-muted-foreground">
                {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>
          </div>
          <button onClick={close} className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Summary bar ── */}
        {!loading && data.length > 0 && (
          <div className="grid grid-cols-3 divide-x border-b bg-muted/30">
            <div className="px-6 py-3">
              <p className="text-[11px] text-muted-foreground font-medium">Total Outstanding</p>
              <p className="text-lg font-bold text-red-600 mt-0.5">{fmt(total)}</p>
            </div>
            <div className="px-6 py-3">
              <p className="text-[11px] text-muted-foreground font-medium">Parties</p>
              <p className="text-lg font-bold text-foreground mt-0.5">{data.length}</p>
            </div>
            <div className="px-6 py-3">
              <p className="text-[11px] text-muted-foreground font-medium">Pending Bills</p>
              <p className="text-lg font-bold text-foreground mt-0.5">{totalBills}</p>
            </div>
          </div>
        )}

        {/* ── Table header ── */}
        {!loading && data.length > 0 && (
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-6 py-2 bg-muted/20 border-b">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Party</span>
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider w-20 text-center">Overdue</span>
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider w-24 text-right">Net Due</span>
            <span className="w-16" />
          </div>
        )}

        {/* ── Rows ── */}
        <div className="overflow-y-auto max-h-[50vh] divide-y">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-14 gap-2">
              <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground animate-spin" />
              <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
          ) : data.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 gap-2 text-center px-6">
              <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-950/40 flex items-center justify-center">
                <span className="text-green-600 font-bold text-lg">✓</span>
              </div>
              <p className="font-semibold text-foreground text-sm">No overdue payments</p>
              <p className="text-xs text-muted-foreground">All parties are settled as of today.</p>
            </div>
          ) : data.map((po) => {
            const exp = expanded === po.client.id;
            const maxDays = Math.max(...po.bills.map((b) => daysSince(b.dueDate)));
            const hasPhone = !!po.client.phone;

            return (
              <div key={po.client.id}>
                {/* Party row */}
                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center px-6 py-3.5 hover:bg-muted/30 transition-colors">

                  {/* Name + phone */}
                  <div className="min-w-0 flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground font-semibold text-sm">
                      {po.client.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{po.client.name}</p>
                      {hasPhone ? (
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Phone className="h-2.5 w-2.5" />{po.client.phone}
                        </span>
                      ) : (
                        <span className="text-[11px] text-amber-600 dark:text-amber-400">No phone number</span>
                      )}
                    </div>
                  </div>

                  {/* Days overdue */}
                  <div className="w-20 text-center">
                    <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-md ${
                      maxDays > 60
                        ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400"
                        : maxDays > 30
                        ? "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-400"
                        : "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/60 dark:text-yellow-400"
                    }`}>
                      {maxDays}d
                    </span>
                    <p className="text-[9px] text-muted-foreground mt-0.5">{po.bills.length} bill{po.bills.length > 1 ? "s" : ""}</p>
                  </div>

                  {/* Amount */}
                  <div className="w-24 text-right">
                    <p className="text-sm font-bold text-red-600">{fmt(po.totalOverdue)}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 w-16 justify-end">
                    <button
                      onClick={() => setExpanded(exp ? null : po.client.id)}
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      title={exp ? "Collapse" : "View bills"}
                    >
                      {exp ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      onClick={() => waParty(po)}
                      disabled={!hasPhone}
                      title={hasPhone ? "Send WhatsApp reminder" : "No phone — edit party to add one"}
                      className={`flex h-7 w-7 items-center justify-center rounded-md border transition-colors ${
                        hasPhone
                          ? "border-green-200 dark:border-green-900 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30"
                          : "border-border text-muted-foreground/30 cursor-not-allowed"
                      }`}
                    >
                      <WhatsAppIcon size={13} />
                    </button>
                  </div>
                </div>

                {/* Expanded bills */}
                {exp && (
                  <div className="bg-muted/20 border-t border-border/60">
                    {/* Bill column headers */}
                    <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 px-8 py-1.5 border-b border-border/40">
                      <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Bill No.</span>
                      <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider w-24 text-center">Due Date</span>
                      <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider w-20 text-right">Amount</span>
                      <div className="w-7" />
                      <div className="w-7" />
                    </div>
                    {po.bills.map((bill) => {
                      const due = Math.max(0, (bill.total || 0) - (bill.paidAmount || 0));
                      const days = daysSince(bill.dueDate);
                      return (
                        <div key={bill.id} className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 items-center px-8 py-2.5 border-b border-border/30 last:border-0 hover:bg-muted/30 transition-colors">
                          <div>
                            <span className="text-xs font-semibold text-foreground">#{bill.billNumber}</span>
                            <span className="text-[10px] text-muted-foreground ml-2">{days} days ago</span>
                          </div>
                          <span className="text-xs text-red-500 font-medium w-24 text-center">{fmtDate(bill.dueDate)}</span>
                          <span className="text-xs font-bold text-red-600 w-20 text-right">{fmt(due)}</span>
                          <button
                            onClick={() => window.open(billLink(bill.id), "_blank")}
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-primary hover:bg-muted transition-colors"
                            title="View bill"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => waBill(po.client, bill)}
                            disabled={!hasPhone}
                            title={hasPhone ? "Send WhatsApp for this bill" : "No phone number"}
                            className={`flex h-7 w-7 items-center justify-center rounded-md border transition-colors ${
                              hasPhone
                                ? "border-green-200 dark:border-green-900 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30"
                                : "border-border text-muted-foreground/20 cursor-not-allowed"
                            }`}
                          >
                            <WhatsAppIcon size={11} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-end border-t px-5 py-3">
          <button
            onClick={close}
            className="text-sm font-medium px-5 py-2 rounded-lg bg-foreground text-background hover:opacity-80 transition-opacity"
          >
            Dismiss
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
