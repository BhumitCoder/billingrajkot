import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Calculator as CalcIcon,
  History,
  Trash2,
  Percent,
  TrendingUp,
  Receipt,
  Delete,
  Divide,
  X,
  Minus,
  Plus,
  Equal,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Tag,
  ArrowRightLeft,
  Info,
  Banknote,
  Briefcase,
  TrendingDown,
  Scale,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const CalculatorPage = () => {
  const [display, setDisplay] = useState("0");
  const [equation, setEquation] = useState("");
  const [history, setHistory] = useState<
    { eq: string; res: string; type?: string }[]
  >([]);
  const [showHistory, setShowHistory] = useState(false);
  const [memory, setMemory] = useState(0);

  // Business specific states
  const [gstRate, setGstRate] = useState(18);
  const [marginRate, setMarginRate] = useState(20);
  const [discountRate, setDiscountRate] = useState(10);
  const [taxRate, setTaxRate] = useState(5);

  const handleNumber = (num: string) => {
    if (display === "0" || display === "Error") {
      setDisplay(num);
    } else {
      setDisplay(display + num);
    }
  };

  const handleOperator = (op: string) => {
    if (display === "Error") return;
    setEquation(display + " " + op + " ");
    setDisplay("0");
  };

  const calculate = () => {
    try {
      if (!equation || display === "Error") return;
      const fullEq = equation + display;
      const result = new Function(
        "return " + fullEq.replace(/x/g, "*").replace(/÷/g, "/"),
      )();
      const formattedResult = Number(result.toFixed(4)).toString();

      setHistory(
        [{ eq: fullEq, res: formattedResult }, ...history].slice(0, 10),
      );
      setDisplay(formattedResult);
      setEquation("");
    } catch (e) {
      setDisplay("Error");
    }
  };

  const clear = () => {
    setDisplay("0");
    setEquation("");
  };

  const backspace = () => {
    if (display.length > 1) {
      setDisplay(display.slice(0, -1));
    } else {
      setDisplay("0");
    }
  };

  // Business Functions
  const addTax = () => {
    const val = parseFloat(display);
    if (isNaN(val)) return;
    const gst = (val * gstRate) / 100;
    const total = val + gst;
    const res = total.toFixed(2);
    setHistory(
      [{ eq: `${val} + ${gstRate}% Tax`, res, type: "Tax" }, ...history].slice(
        0,
        10,
      ),
    );
    setEquation(`${val} + ${gstRate}% Tax`);
    setDisplay(res);
  };

  const removeTax = () => {
    const val = parseFloat(display);
    if (isNaN(val)) return;
    const base = val / (1 + gstRate / 100);
    const res = base.toFixed(2);
    setHistory(
      [{ eq: `${val} - ${gstRate}% Tax`, res, type: "Tax" }, ...history].slice(
        0,
        10,
      ),
    );
    setEquation(`${val} incl. ${gstRate}% Tax`);
    setDisplay(res);
  };

  const applyMargin = () => {
    const cost = parseFloat(display);
    if (isNaN(cost)) return;
    const price = cost / (1 - marginRate / 100);
    const res = price.toFixed(2);
    setHistory(
      [
        { eq: `${cost} @ ${marginRate}% Margin`, res, type: "Margin" },
        ...history,
      ].slice(0, 10),
    );
    setEquation(`${cost} cost + ${marginRate}% Margin`);
    setDisplay(res);
  };

  const applyDiscount = () => {
    const val = parseFloat(display);
    if (isNaN(val)) return;
    const discount = (val * discountRate) / 100;
    const res = (val - discount).toFixed(2);
    setHistory(
      [
        { eq: `${val} - ${discountRate}% Disc`, res, type: "Discount" },
        ...history,
      ].slice(0, 10),
    );
    setEquation(`${val} - ${discountRate}% Discount`);
    setDisplay(res);
  };

  const calculateMarkup = () => {
    const cost = parseFloat(display);
    if (isNaN(cost)) return;
    const markup = (cost * marginRate) / 100;
    const res = (cost + markup).toFixed(2);
    setHistory(
      [
        { eq: `${cost} + ${marginRate}% Markup`, res, type: "Markup" },
        ...history,
      ].slice(0, 10),
    );
    setEquation(`${cost} cost + ${marginRate}% Markup`);
    setDisplay(res);
  };

  const calculateTax = () => {
    const val = parseFloat(display);
    if (isNaN(val)) return;
    const tax = (val * taxRate) / 100;
    const res = (val + tax).toFixed(2);
    setHistory(
      [{ eq: `${val} + ${taxRate}% Tax`, res, type: "Tax" }, ...history].slice(
        0,
        10,
      ),
    );
    setEquation(`${val} + ${taxRate}% Tax`);
    setDisplay(res);
  };

  const calculateProfit = () => {
    const val = parseFloat(display);
    if (isNaN(val)) return;
    const profit = val * (marginRate / 100);
    const res = profit.toFixed(2);
    setHistory(
      [
        { eq: `Profit on ${val} (${marginRate}%)`, res, type: "Profit" },
        ...history,
      ].slice(0, 10),
    );
    setEquation(`Profit on ${val} @ ${marginRate}%`);
    setDisplay(res);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") {
        handleNumber(e.key);
      } else if (e.key === ".") {
        handleNumber(".");
      } else if (e.key === "+") {
        handleOperator("+");
      } else if (e.key === "-") {
        handleOperator("-");
      } else if (e.key === "*") {
        handleOperator("x");
      } else if (e.key === "/") {
        e.preventDefault();
        handleOperator("÷");
      } else if (e.key === "Enter" || e.key === "=") {
        e.preventDefault();
        calculate();
      } else if (e.key === "Backspace") {
        backspace();
      } else if (e.key === "Escape") {
        clear();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [display, equation]);

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-3 overflow-hidden">
      {/* Header Section */}
      <div className="sticky top-0 z-20 shrink-0 rounded-2xl border border-border/70 bg-gradient-to-br from-background via-background to-slate-50/40 p-3 shadow-sm sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center justify-start gap-3 sm:gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-border">
              <CalcIcon className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 text-left">
              <h1 className="truncate text-2xl font-semibold leading-tight sm:text-3xl">
                Calculator
              </h1>
              <p className="text-sm text-muted-foreground">
                Financial precision for your business
              </p>
            </div>
          </div>
          <div className="grid w-full grid-cols-1 gap-2 rounded-xl border border-border/70 bg-muted/30 p-2 lg:w-auto">
            <Button
              variant="outline"
              onClick={() => setShowHistory(!showHistory)}
              className={cn(
                "h-10 rounded-xl px-3 text-sm gap-2 transition-all",
                showHistory && "bg-primary/10 border-primary/50 text-primary",
              )}
            >
              <History className="h-4 w-4" />
              {showHistory ? "Hide History" : "History"}
            </Button>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-border/70 bg-background/70 p-2 sm:p-4">
        <div className="h-full overflow-y-auto pr-1 sm:pr-2">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Calculator Body */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-4">
          <Card className="overflow-hidden border shadow-md bg-card rounded-xl">
            <CardContent className="p-0">
              {/* Display Area */}
              <div className="bg-muted/30 dark:bg-black/40 p-6 text-right space-y-2 min-h-[120px] flex flex-col justify-end border-b">
                <div className="text-xs font-mono tracking-wider text-primary/70 h-5 overflow-hidden uppercase">
                  {equation || "READY"}
                </div>
                <div className="text-5xl font-bold tracking-tighter text-foreground font-mono break-all leading-none">
                  {display}
                </div>
              </div>

              {/* Enhanced Business Control Strip */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2 p-3 bg-muted/20 border-b">
                <Button
                  variant="outline"
                  className="h-10 text-[10px] font-bold gap-1.5 border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-all"
                  onClick={addTax}
                >
                  + Tax
                </Button>
                <Button
                  variant="outline"
                  className="h-10 text-[10px] font-bold gap-1.5 border-rose-500/20 bg-rose-500/5 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-all"
                  onClick={removeTax}
                >
                  - Tax
                </Button>
                <Button
                  variant="outline"
                  className="h-10 text-[10px] font-bold gap-1.5 border-blue-500/20 bg-blue-500/5 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 transition-all"
                  onClick={applyMargin}
                >
                  MARGIN
                </Button>
                <Button
                  variant="outline"
                  className="h-10 text-[10px] font-bold gap-1.5 border-amber-500/20 bg-amber-500/5 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 transition-all"
                  onClick={applyDiscount}
                >
                  DISC
                </Button>
                <Button
                  variant="outline"
                  className="h-10 text-[10px] font-bold gap-1.5 border-indigo-500/20 bg-indigo-500/5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 transition-all md:hidden lg:flex"
                  onClick={calculateProfit}
                >
                  PROFIT
                </Button>
              </div>

              {/* Professional Keypad */}
              <div className="p-4 grid grid-cols-4 gap-2 bg-card">
                {/* Row 1 */}
                <Button
                  variant="destructive"
                  className="h-14 text-lg font-bold shadow-sm active:scale-95 transition-all"
                  onClick={clear}
                >
                  AC
                </Button>
                <Button
                  variant="secondary"
                  className="h-14 text-lg font-bold shadow-sm active:scale-95 transition-all"
                  onClick={backspace}
                >
                  <Delete className="w-5 h-5" />
                </Button>
                <Button
                  variant="secondary"
                  className="h-14 text-lg font-bold shadow-sm active:scale-95 transition-all"
                  onClick={() => handleOperator("%")}
                >
                  <Percent className="w-5 h-5" />
                </Button>
                <Button
                  variant="secondary"
                  className="h-14 text-lg font-bold shadow-sm text-primary active:scale-95 transition-all border border-primary/10"
                  onClick={() => handleOperator("÷")}
                >
                  <Divide className="w-5 h-5" />
                </Button>

                {/* Row 2 */}
                <Button
                  variant="ghost"
                  className="h-14 text-2xl font-bold bg-muted/40 hover:bg-muted border border-border/50 active:scale-95 transition-all"
                  onClick={() => handleNumber("7")}
                >
                  7
                </Button>
                <Button
                  variant="ghost"
                  className="h-14 text-2xl font-bold bg-muted/40 hover:bg-muted border border-border/50 active:scale-95 transition-all"
                  onClick={() => handleNumber("8")}
                >
                  8
                </Button>
                <Button
                  variant="ghost"
                  className="h-14 text-2xl font-bold bg-muted/40 hover:bg-muted border border-border/50 active:scale-95 transition-all"
                  onClick={() => handleNumber("9")}
                >
                  9
                </Button>
                <Button
                  variant="secondary"
                  className="h-14 text-lg font-bold shadow-sm text-primary active:scale-95 transition-all border border-primary/10"
                  onClick={() => handleOperator("x")}
                >
                  <X className="w-5 h-5" />
                </Button>

                {/* Row 3 */}
                <Button
                  variant="ghost"
                  className="h-14 text-2xl font-bold bg-muted/40 hover:bg-muted border border-border/50 active:scale-95 transition-all"
                  onClick={() => handleNumber("4")}
                >
                  4
                </Button>
                <Button
                  variant="ghost"
                  className="h-14 text-2xl font-bold bg-muted/40 hover:bg-muted border border-border/50 active:scale-95 transition-all"
                  onClick={() => handleNumber("5")}
                >
                  5
                </Button>
                <Button
                  variant="ghost"
                  className="h-14 text-2xl font-bold bg-muted/40 hover:bg-muted border border-border/50 active:scale-95 transition-all"
                  onClick={() => handleNumber("6")}
                >
                  6
                </Button>
                <Button
                  variant="secondary"
                  className="h-14 text-lg font-bold shadow-sm text-primary active:scale-95 transition-all border border-primary/10"
                  onClick={() => handleOperator("-")}
                >
                  <Minus className="w-5 h-5" />
                </Button>

                {/* Row 4 */}
                <Button
                  variant="ghost"
                  className="h-14 text-2xl font-bold bg-muted/40 hover:bg-muted border border-border/50 active:scale-95 transition-all"
                  onClick={() => handleNumber("1")}
                >
                  1
                </Button>
                <Button
                  variant="ghost"
                  className="h-14 text-2xl font-bold bg-muted/40 hover:bg-muted border border-border/50 active:scale-95 transition-all"
                  onClick={() => handleNumber("2")}
                >
                  2
                </Button>
                <Button
                  variant="ghost"
                  className="h-14 text-2xl font-bold bg-muted/40 hover:bg-muted border border-border/50 active:scale-95 transition-all"
                  onClick={() => handleNumber("3")}
                >
                  3
                </Button>
                <Button
                  variant="secondary"
                  className="h-14 text-lg font-bold shadow-sm text-primary active:scale-95 transition-all border border-primary/10"
                  onClick={() => handleOperator("+")}
                >
                  <Plus className="w-5 h-5" />
                </Button>

                {/* Row 5 */}
                <Button
                  variant="ghost"
                  className="h-14 text-2xl font-bold bg-muted/40 hover:bg-muted border border-border/50 active:scale-95 transition-all"
                  onClick={() => handleNumber("0")}
                >
                  0
                </Button>
                <Button
                  variant="ghost"
                  className="h-14 text-2xl font-bold bg-muted/40 hover:bg-muted border border-border/50 active:scale-95 transition-all"
                  onClick={() => handleNumber("00")}
                >
                  00
                </Button>
                <Button
                  variant="ghost"
                  className="h-14 text-2xl font-bold bg-muted/40 hover:bg-muted border border-border/50 active:scale-95 transition-all"
                  onClick={() => handleNumber(".")}
                >
                  .
                </Button>
                <Button
                  variant="default"
                  className="h-14 text-lg font-bold bg-primary hover:bg-primary/90 shadow-md shadow-primary/20 active:scale-95 transition-all"
                  onClick={calculate}
                >
                  <Equal className="w-6 h-6" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - Settings & Logs */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-4">
          <Card className="border shadow-sm bg-card">
            <CardHeader className="py-3 border-b">
              <CardTitle className="text-xs font-bold flex items-center gap-2 uppercase tracking-widest text-primary">
                <Receipt className="w-3.5 h-3.5" /> Config
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-6">
              {/* Tax Rate */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    TAX RATE (%)
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={gstRate}
                      onChange={(e) =>
                        setGstRate(parseFloat(e.target.value) || 0)
                      }
                      className="w-16 h-7 text-xs bg-muted border-border text-center font-mono font-bold text-primary"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {[5, 12, 18, 28].map((rate) => (
                    <Button
                      key={rate}
                      size="sm"
                      variant={gstRate === rate ? "default" : "outline"}
                      className="h-8 text-[10px] font-bold transition-all"
                      onClick={() => setGstRate(rate)}
                    >
                      {rate}%
                    </Button>
                  ))}
                </div>
              </div>

              {/* Margin Rate */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    MARGIN (%)
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={marginRate}
                      onChange={(e) =>
                        setMarginRate(parseFloat(e.target.value) || 0)
                      }
                      className="w-16 h-7 text-xs bg-muted border-border text-center font-mono font-bold text-emerald-600 dark:text-emerald-400"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {[10, 20, 30, 50].map((rate) => (
                    <Button
                      key={rate}
                      size="sm"
                      variant={marginRate === rate ? "default" : "outline"}
                      className={cn(
                        "h-8 text-[10px] font-bold transition-all",
                        marginRate === rate &&
                          "bg-emerald-600 hover:bg-emerald-500 text-white",
                      )}
                      onClick={() => setMarginRate(rate)}
                    >
                      {rate}%
                    </Button>
                  ))}
                </div>
              </div>

              {/* Discount Rate */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    DISCOUNT (%)
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={discountRate}
                      onChange={(e) =>
                        setDiscountRate(parseFloat(e.target.value) || 0)
                      }
                      className="w-16 h-7 text-xs bg-muted border-border text-center font-mono font-bold text-amber-600 dark:text-amber-400"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {[5, 10, 15, 20].map((rate) => (
                    <Button
                      key={rate}
                      size="sm"
                      variant={discountRate === rate ? "default" : "outline"}
                      className={cn(
                        "h-8 text-[10px] font-bold transition-all",
                        discountRate === rate &&
                          "bg-amber-600 hover:bg-amber-500 text-white",
                      )}
                      onClick={() => setDiscountRate(rate)}
                    >
                      {rate}%
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {showHistory && (
            <Card className="border shadow-sm bg-card animate-in fade-in slide-in-from-bottom-2 duration-300">
              <CardHeader className="py-2.5 px-4 border-b flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-bold flex items-center gap-2 uppercase tracking-widest text-muted-foreground">
                  <History className="w-3.5 h-3.5" /> Audit Logs
                </CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:bg-destructive/10"
                  onClick={() => setHistory([])}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </CardHeader>
              <CardContent className="pt-4 px-4 pb-4">
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                  {history.length === 0 ? (
                    <div className="text-center py-10 opacity-30">
                      <p className="text-[10px] font-bold tracking-widest uppercase">
                        Empty
                      </p>
                    </div>
                  ) : (
                    history.map((item, i) => (
                      <div
                        key={i}
                        className="group p-3 rounded-lg bg-muted/30 border border-transparent hover:border-primary/50 hover:bg-muted/50 transition-all cursor-pointer text-right"
                        onClick={() => setDisplay(item.res)}
                      >
                        <div className="flex justify-between items-center mb-1">
                          {item.type && (
                            <Badge
                              variant="outline"
                              className="text-[8px] font-black h-4 uppercase bg-primary/10 text-primary border-primary/20"
                            >
                              {item.type}
                            </Badge>
                          )}
                          <div className="text-[10px] text-muted-foreground font-mono flex-1 font-medium">
                            {item.eq}
                          </div>
                        </div>
                        <div className="text-lg font-bold font-mono text-foreground group-hover:text-primary transition-colors">
                          {item.res}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
        </div>
      </div>
    </div>
  );
};

export default CalculatorPage;
