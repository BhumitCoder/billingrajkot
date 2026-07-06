import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "./ui/button";
import { checkSessionExpiry, logout, getCurrentUser } from "@/pages/Auth";
import { toast } from "sonner";
import {
  LayoutDashboard,
  FileText,
  Package,
  Users,
  Settings,
  Sun,
  Moon,
  ShoppingCart,
  BookOpen,
  LogOut,
  ScanSearch,
  ClipboardCheck,
  X,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  GripVertical,
  BarChart3,
  Receipt,
  RotateCcw,
  Sparkles,
  MoreHorizontal,
  Landmark,
  Search,
  Loader2,
} from "lucide-react";
import { getCompanyProfile, getEncryptionConfig } from "@/lib/storage";
import { initEncryptionKey, isEncryptionConfigured, restoreEncryptionFromRemote } from "@/lib/crypto";
import { GlobalSearch } from "@/components/GlobalSearch";
import { IBallAI } from "@/components/IBallAI";
import { OverdueBillsDialog, shouldShowOverdueToday } from "@/components/OverdueBillsDialog";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "./ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Keyboard } from "lucide-react";
import { EncryptionKeyDialog } from "./EncryptionKeyDialog";
import { AdminRecoveryDialog } from "./AdminRecoveryDialog";
import { useEncryptionLock } from "@/contexts/EncryptionLockContext";

interface LayoutProps {
  children: React.ReactNode;
}

function ShortcutSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-1">
      <p className="px-5 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
        {title}
      </p>
      <div className="space-y-px">{children}</div>
    </div>
  );
}

function ShortcutRow({ label, modifier, keys, note }: {
  label: string;
  modifier: string;
  keys: string[];
  note?: string;
}) {
  return (
    <div className="flex items-center justify-between px-5 py-2 hover:bg-muted/50 transition-colors">
      <div>
        <span className="text-sm font-medium">{label}</span>
        {note && <span className="ml-1.5 text-[10px] text-muted-foreground">{note}</span>}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground">
          {modifier}
        </kbd>
        <span className="text-[10px] text-muted-foreground">+</span>
        {keys.map((k) => (
          <kbd key={k} className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground">
            {k}
          </kbd>
        ))}
      </div>
    </div>
  );
}

function getInitialSidebarOpen(): boolean {
  if (typeof document === "undefined") return true;
  const match = document.cookie.match(/sidebar:state=(\w+)/);
  return match ? match[1] === "true" : true;
}

function AppSidebarContent({
  navItems,
  isActive,
  company,
  user,
  onNavClick,
  onReorder,
  theme,
  toggleTheme,
  handleLogout,
  onSearchOpen,
  shortcutsOpen,
  setShortcutsOpen,
}: {
  navItems: { path: string; icon: React.ElementType; label: string }[];
  isActive: (path: string) => boolean;
  company: any;
  user: any;
  onNavClick: () => void;
  onReorder: (path: string, direction: "up" | "down") => void;
  theme: string;
  toggleTheme: () => void;
  handleLogout: () => void;
  onSearchOpen: () => void;
  shortcutsOpen: boolean;
  setShortcutsOpen: (v: boolean) => void;
}) {
  const { isMobile, setOpenMobile } = useSidebar();
  const [manageMode, setManageMode] = useState(false);
  const location = useLocation();
  const [encKeyOpen, setEncKeyOpen] = useState(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const profileClickCount = useRef(0);
  const profileClickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoClickCount = useRef(0);
  const logoClickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleProfileClick = () => {
    profileClickCount.current += 1;
    if (profileClickTimer.current) clearTimeout(profileClickTimer.current);
    if (profileClickCount.current >= 5) {
      profileClickCount.current = 0;
      setEncKeyOpen(true);
      return;
    }
    profileClickTimer.current = setTimeout(() => { profileClickCount.current = 0; }, 1500);
  };

  const handleLogoClick = () => {
    logoClickCount.current += 1;
    if (logoClickTimer.current) clearTimeout(logoClickTimer.current);
    if (logoClickCount.current >= 5) {
      logoClickCount.current = 0;
      setRecoveryOpen(true);
      return;
    }
    logoClickTimer.current = setTimeout(() => { logoClickCount.current = 0; }, 1500);
  };

  const handleNavClick = () => {
    if (manageMode) return;
    if (isMobile) setOpenMobile(false);
    onNavClick();
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setManageMode(!manageMode);
  };

  return (
    <>
      <div className="flex flex-col h-full">
        <div className="sticky top-0 z-10 bg-sidebar border-b border-sidebar-border/50 group-data-[collapsible=icon]:hidden">
          <div className="px-3 py-4 flex items-center justify-center relative">
            <div className="shrink-0 select-none" onClick={handleLogoClick}>
              {company?.logo ? (
                <img
                  src={company.logo}
                  alt="Logo"
                  style={{
                    width: company.logoWidth ?? company.logoSize ?? 40,
                    height: company.logoHeight ?? company.logoSize ?? 40,
                  }}
                  className="object-contain rounded-md"
                />
              ) : (
                <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
              )}
            </div>
            {manageMode && (
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-primary absolute right-3"
                onClick={() => setManageMode(false)}
              >
                <X className="size-3" />
              </Button>
            )}
          </div>
        </div>

        {/* Search button — full width, shown when sidebar is expanded */}
        <button
          onClick={onSearchOpen}
          className="mx-3 mt-3 mb-2 flex items-center gap-2 rounded-lg border border-sidebar-border/50 bg-sidebar-accent/30 px-3 py-2 text-xs text-sidebar-foreground/50 hover:bg-primary/5 hover:text-primary transition-colors group-data-[collapsible=icon]:hidden"
        >
          <Search className="size-3.5 shrink-0" />
          <span className="flex-1 text-left">Search…</span>
          <kbd className="rounded border border-border/50 bg-muted px-1 py-0.5 text-[10px] font-mono">
            ⌘K
          </kbd>
        </button>

        <SidebarContent className="flex-1 overflow-y-auto px-2 py-2 pb-20 group-data-[collapsible=icon]:pb-32 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-primary/20 hover:[&::-webkit-scrollbar-thumb]:bg-primary/40 [&::-webkit-scrollbar-track]:bg-transparent">
          <SidebarGroup className="p-0">
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                {navItems.map((item, index) => {
                  const Icon = item.icon;
                  const active = isActive(item.path);

                  const menuButton = (
                    <SidebarMenuButton
                      tooltip={item.label}
                      size="default"
                      onDoubleClick={handleDoubleClick}
                      className={cn(
                        "rounded-lg px-3 h-10 transition-all duration-200 relative group/btn",
                        active && !manageMode
                          ? "bg-primary/10 text-primary font-semibold shadow-none border-l-2 border-primary rounded-l-none group-data-[collapsible=icon]:border-l-0 group-data-[collapsible=icon]:rounded-lg group-data-[collapsible=icon]:bg-primary/20 group-data-[collapsible=icon]:ring-1 group-data-[collapsible=icon]:ring-primary/40 group-data-[collapsible=icon]:shadow-[0_6px_18px_rgba(59,130,246,0.25)] group-data-[collapsible=icon]:scale-[1.04]"
                          : "hover:bg-sidebar-accent text-sidebar-foreground/70",
                        manageMode &&
                        "border border-dashed border-primary/30 bg-primary/5",
                      )}
                    >
                      {manageMode ? (
                        <GripVertical className="size-4 shrink-0 text-primary/50" />
                      ) : (
                        <Icon className="size-5 shrink-0 group-data-[collapsible=icon]:size-6" />
                      )}
                      <span className="ml-2 flex-1 truncate">{item.label}</span>

                      {manageMode ? (
                        <div className="flex items-center gap-0.5 ml-auto">
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={index === 0}
                            className="h-6 w-6 rounded-sm hover:bg-primary/20 hover:text-primary disabled:opacity-30"
                            onClick={(e) => {
                              e.stopPropagation();
                              onReorder(item.path, "up");
                            }}
                          >
                            <ChevronUp className="size-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={index === navItems.length - 1}
                            className="h-6 w-6 rounded-sm hover:bg-primary/20 hover:text-primary disabled:opacity-30"
                            onClick={(e) => {
                              e.stopPropagation();
                              onReorder(item.path, "down");
                            }}
                          >
                            <ChevronDown className="size-3" />
                          </Button>
                        </div>
                      ) : (
                        item.label === "Bills" && (
                          <ChevronRight
                            className={cn(
                              "ml-auto transition-transform duration-200 size-3.5 opacity-50",
                              "group-data-[state=open]/collapsible:rotate-90",
                            )}
                          />
                        )
                      )}
                    </SidebarMenuButton>
                  );

                  return (
                    <SidebarMenuItem key={item.path}>
                      {manageMode ? (
                        menuButton
                      ) : (
                        <Link
                          to={item.path}
                          onClick={handleNavClick}
                          className="block w-full"
                        >
                          {menuButton}
                        </Link>
                      )}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </div>
      <SidebarFooter className="sticky bottom-0 border-t border-sidebar-border/40 p-2 bg-sidebar z-10">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-3">
            <div
              onClick={handleProfileClick}
              className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0 group-data-[collapsible=icon]:h-10 group-data-[collapsible=icon]:w-10 group-data-[collapsible=icon]:text-xs select-none"
            >
              {(user.name ?? "U").charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
              <p className="text-[10px] font-medium text-sidebar-foreground truncate">
                {user.name ?? ""}
              </p>
              <p className="text-[8px] text-sidebar-foreground/50 truncate uppercase tracking-wider">
                {user.role}
              </p>
            </div>
            <div className="flex items-center group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-2">
              <div className="group-data-[collapsible=icon]:hidden flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleTheme}
                  aria-label="Toggle theme"
                  className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors"
                >
                  {theme === "light" ? (
                    <Moon className="size-4" />
                  ) : (
                    <Sun className="size-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShortcutsOpen(true)}
                  aria-label="Keyboard shortcuts"
                  className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors hidden lg:inline-flex"
                >
                  <Keyboard className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleLogout}
                  aria-label="Logout"
                  className="h-8 w-8 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <LogOut className="size-4" />
                </Button>
              </div>
              <SidebarTrigger
                className="h-8 w-8 group-data-[collapsible=icon]:h-10 group-data-[collapsible=icon]:w-10"
                aria-label="Toggle sidebar"
              />
            </div>
          </div>
        </div>
      </SidebarFooter>

      {/* ── Keyboard shortcuts panel (right-side sheet, desktop only) ── */}
      <Sheet open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
        <SheetContent side="right" className="w-80 p-0 flex flex-col">
          <SheetHeader className="px-5 pt-5 pb-3 border-b border-border/60">
            <SheetTitle className="flex items-center gap-2 text-sm font-semibold">
              <Keyboard className="size-4 text-primary" />
              Keyboard Shortcuts
            </SheetTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Works on desktop only — shortcuts are blocked when typing in a field
            </p>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto py-3">

            {/* Navigation */}
            <ShortcutSection title="Navigation">
              {navShortcuts.map((s) => (
                <ShortcutRow key={s.path} label={s.label} modifier="Alt" keys={[s.key]} />
              ))}
            </ShortcutSection>

            {/* Global actions */}
            <ShortcutSection title="Global Actions">
              <ShortcutRow label="New Sale"        modifier="Alt"  keys={["N"]} note="Open new bill" />
              <ShortcutRow label="Toggle Theme"    modifier="Alt"  keys={["D"]} note="Dark / light" />
              <ShortcutRow label="Shortcuts Panel" modifier="Alt"  keys={[","]} note="Open this panel" />
              <ShortcutRow label="Search"          modifier="Ctrl" keys={["K"]} note="Global search" />
            </ShortcutSection>

            {/* Sale page */}
            <ShortcutSection title="Sale Page">
              <ShortcutRow label="New Sale"    modifier="Alt"  keys={["A"]} />
            </ShortcutSection>

            {/* Sale form */}
            <ShortcutSection title="Sale Form">
              <ShortcutRow label="Add Item"    modifier="Alt"  keys={["A"]} />
              <ShortcutRow label="Scan Barcode" modifier="Alt" keys={["V"]} />
              <ShortcutRow label="Save Bill"   modifier="Ctrl" keys={["↵"]} />
            </ShortcutSection>

            {/* Expenses */}
            <ShortcutSection title="Expenses Page">
              <ShortcutRow label="Add Expense" modifier="Alt" keys={["A"]} />
            </ShortcutSection>

            {/* Purchase */}
            <ShortcutSection title="Purchase Page">
              <ShortcutRow label="New Purchase Bill" modifier="Alt"  keys={["A"]} />
            </ShortcutSection>

            {/* Purchase form */}
            <ShortcutSection title="Purchase Form">
              <ShortcutRow label="Add Item"  modifier="Alt"  keys={["W"]} />
              <ShortcutRow label="Save Bill" modifier="Ctrl" keys={["S"]} />
            </ShortcutSection>

          </div>
        </SheetContent>
      </Sheet>

      <EncryptionKeyDialog open={encKeyOpen} onOpenChange={setEncKeyOpen} />
      <AdminRecoveryDialog open={recoveryOpen} onOpenChange={setRecoveryOpen} />
    </>
  );
}

const bottomPrimaryNav = [
  { path: "/", icon: LayoutDashboard, label: "Home" },
  { path: "/bills", icon: FileText, label: "Sale" },
  { path: "/purchases", icon: ShoppingCart, label: "Purchase" },
  { path: "/clients", icon: Users, label: "Party" },
];

const bottomMoreNav = [
  // { path: "/products", icon: Package, label: "Item" },
  { path: "/bank-accounts", icon: Landmark, label: "Bank & Cash" },
  { path: "/returns", icon: RotateCcw, label: "Mobile Return" },
  { path: "/expenses", icon: Receipt, label: "Expenses" },
  { path: "/passbook", icon: BookOpen, label: "Passbook" },
  { path: "/report", icon: BarChart3, label: "Report" },
  { path: "/settings", icon: Settings, label: "Settings" },
  { path: "/imei-timeline", icon: ScanSearch, label: "IMEI" },
];

// Navigation shortcuts — Alt + key
export const navShortcuts: { path: string; label: string; key: string }[] = [
  { path: "/",              label: "Home",          key: "H" },
  { path: "/bills",         label: "Sale",          key: "S" },
  { path: "/purchases",     label: "Purchase",      key: "B" },
  { path: "/clients",       label: "Party",         key: "P" },
  { path: "/bank-accounts", label: "Bank & Cash",   key: "K" },
  { path: "/returns",       label: "Mobile Return", key: "R" },
  { path: "/expenses",      label: "Expenses",      key: "E" },
  { path: "/passbook",      label: "Passbook",      key: "L" },
  { path: "/report",        label: "Report",        key: "T" },
  { path: "/settings",      label: "Settings",      key: "G" },
  { path: "/imei-timeline", label: "IMEI",          key: "I" },
];

// Global action shortcuts (handled in Layout)
export const globalShortcuts = [
  { label: "New Sale",        modifier: "Alt", key: "N", note: "Open new bill form" },
  { label: "Toggle Theme",    modifier: "Alt", key: "D", note: "Dark / light mode" },
  { label: "Shortcuts Panel", modifier: "Alt", key: ",", note: "Open this panel" },
];

// Page-specific shortcuts (handled inside each page component)
export const pageShortcuts = [
  { page: "Sale Page",    label: "New Sale",        modifier: "Alt",  key: "A" },
  { page: "Sale Form",    label: "Add Item",        modifier: "Alt",  key: "A" },
  { page: "Sale Form",    label: "Scan Barcode",    modifier: "Alt",  key: "V" },
  { page: "Sale Form",    label: "Save Bill",       modifier: "Ctrl", key: "↵" },
  { page: "Expenses",     label: "Add Expense",    modifier: "Alt",  key: "A" },
  { page: "Purchase Page",  label: "New Purchase Bill", modifier: "Alt",  key: "A" },
  { page: "Purchase Form", label: "Add Item",          modifier: "Alt",  key: "W" },
  { page: "Purchase Form", label: "Save Bill",          modifier: "Ctrl", key: "S" },
];

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { refresh: refreshLock, reloadKey, locked } = useEncryptionLock();
  const [showMoreSheet, setShowMoreSheet] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [overdueOpen, setOverdueOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const overdueShownRef = useRef(false);

  // ── Encryption init — restore from Firestore if localStorage was cleared ──
  const [encInitDone, setEncInitDone] = useState(false);

  useEffect(() => {
    const init = async () => {
      // If localStorage lost enc config (cleared browser, new device), restore from Firestore
      if (!isEncryptionConfigured()) {
        try {
          const remote = await getEncryptionConfig();
          if (remote) {
            restoreEncryptionFromRemote(remote.verifyToken, remote.active);
            refreshLock();
          }
        } catch { /* network error — skip, user will see locked/no-key state */ }
      }
      await initEncryptionKey();
      setEncInitDone(true);
    };
    init();
  }, []);

  useEffect(() => {
    if (!locked && encInitDone && !overdueShownRef.current && shouldShowOverdueToday()) {
      overdueShownRef.current = true;
      const t = setTimeout(() => setOverdueOpen(true), 1200);
      return () => clearTimeout(t);
    }
  }, [locked, encInitDone]);

  // Global keyboard shortcuts — uses e.code so Mac Option+key works correctly
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      // Navigation shortcuts
      const navMatch = navShortcuts.find((s) => e.code === `Key${s.key.toUpperCase()}`);
      if (navMatch) { e.preventDefault(); navigate(navMatch.path); return; }

      // Alt+N → New Sale
      if (e.code === "KeyN") { e.preventDefault(); navigate("/bills/new"); return; }
      // Alt+D → Toggle theme
      if (e.code === "KeyD") { e.preventDefault(); toggleTheme(); return; }
      // Alt+, → Open shortcuts panel
      if (e.code === "Comma") { e.preventDefault(); setShortcutsOpen(true); return; }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate, toggleTheme]);
  const getMobileTitle = (pathname: string) => {
    if (pathname === "/") return "Home";
    if (pathname.startsWith("/bills")) return "Sale";
    if (pathname.startsWith("/purchases")) return "Purchase";
    if (pathname.startsWith("/passbook")) return "Passbook";
    if (pathname.startsWith("/report")) return "Report";
    // if (pathname.startsWith("/products")) return "Item";
    if (pathname.startsWith("/clients")) return "Party";
    if (pathname.startsWith("/bank-accounts")) return "Bank & Cash";
    if (pathname.startsWith("/returns")) return "Mobile Return";
    if (pathname.startsWith("/expenses")) return "Expenses";
    if (pathname.startsWith("/imei-timeline")) return "IMEI";
    if (pathname.startsWith("/settings")) return "Settings";
    return "Ibell";
  };
  const isShellManagedRoute =
    location.pathname === "/" ||
    location.pathname.startsWith("/bills") ||
    location.pathname.startsWith("/purchases") ||
    location.pathname.startsWith("/imei-timeline") ||
    location.pathname.startsWith("/report") ||
    location.pathname.startsWith("/settings") ||
    location.pathname.startsWith("/expenses") ||
    location.pathname.startsWith("/stock-audit") ||
    location.pathname.startsWith("/returns") ||
    location.pathname.startsWith("/passbook") ||
    location.pathname.startsWith("/products") ||
    location.pathname.startsWith("/clients") ||
    location.pathname.startsWith("/vendors") ||
    location.pathname.startsWith("/files") ||
    location.pathname.startsWith("/notes") ||
    location.pathname.startsWith("/calculator") ||
    location.pathname.startsWith("/bank-accounts") ||
    location.pathname.startsWith("/bill-creators") ||
    location.pathname.startsWith("/ai-agent") ||
    location.pathname.startsWith("/business-health") ||
    location.pathname.startsWith("/sample-bill") ||
    location.pathname.startsWith("/sample-bills");
  const [company, setCompany] = useState<any>(null);
  const user = getCurrentUser();
  const permissions =
    user.role === "admin"
      ? []
      : localStorage.getItem("userPermissions")?.split(",") || [];

  useEffect(() => {
    const loadCompany = async () => {
      const companyData = await getCompanyProfile();
      setCompany(companyData);
    };
    loadCompany();
  }, [reloadKey]);

  useEffect(() => {
    const setAppViewportHeight = () => {
      const viewportHeight =
        window.visualViewport?.height || window.innerHeight || 0;
      document.documentElement.style.setProperty(
        "--app-vh",
        `${Math.round(viewportHeight)}px`,
      );
    };

    setAppViewportHeight();
    window.addEventListener("resize", setAppViewportHeight);
    window.visualViewport?.addEventListener("resize", setAppViewportHeight);

    return () => {
      window.removeEventListener("resize", setAppViewportHeight);
      window.visualViewport?.removeEventListener(
        "resize",
        setAppViewportHeight,
      );
    };
  }, []);

  // Global Ctrl+K / Cmd+K shortcut to open search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Check session expiry periodically and auto-logout
  useEffect(() => {
    const checkSession = () => {
      if (!checkSessionExpiry()) {
        logout();
        toast.error("Your session has expired. Please login again.");
        navigate("/auth", { replace: true });
      }
    };
    // Check immediately
    checkSession();
    // Check every 5 minutes
    const interval = setInterval(checkSession, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [navigate]);

  const handleLogout = async () => {
    await logout();
    refreshLock();
    toast.success("Logged out successfully");
    navigate("/auth");
  };

  // Visible nav items - only the required routes
  const allNavItems = [
    { path: "/", icon: LayoutDashboard, label: "Home" },
    { path: "/clients", icon: Users, label: "Party" },
    // { path: "/products", icon: Package, label: "Item" },
    { path: "/bills", icon: FileText, label: "Sale" },
    { path: "/purchases", icon: ShoppingCart, label: "Purchase" },
    { path: "/returns", icon: RotateCcw, label: "Mobile Return" },
    { path: "/bank-accounts", icon: Landmark, label: "Bank & Cash" },
    { path: "/expenses", icon: Receipt, label: "Expenses" },
    { path: "/passbook", icon: BookOpen, label: "Passbook" },
    { path: "/report", icon: BarChart3, label: "Report" },
    { path: "/settings", icon: Settings, label: "Settings" },
    { path: "/imei-timeline", icon: ScanSearch, label: "IMEI" },
    { path: "/stock-audit", icon: ClipboardCheck, label: "Stock Audit" },
  ];

  const [navItems, setNavItems] = useState<any[]>([]);

  useEffect(() => {
    const savedOrder = localStorage.getItem("navItemOrder");
    const items =
      user.role === "admin"
        ? allNavItems
        : allNavItems.filter((item) => permissions.includes(item.path));

    if (savedOrder) {
      try {
        const order = JSON.parse(savedOrder);
        const orderedItems = order
          .map((path: string) => items.find((i) => i.path === path))
          .filter(Boolean);
        const remainingItems = items.filter((i) => !order.includes(i.path));
        setNavItems([...orderedItems, ...remainingItems]);
      } catch (e) {
        setNavItems(items);
      }
    } else {
      setNavItems(items);
    }
  }, [user.role, permissions.join(",")]);

  const handleReorder = (path: string, direction: "up" | "down") => {
    setNavItems((prev) => {
      const index = prev.findIndex((i) => i.path === path);
      if (index === -1) return prev;

      const newItems = [...prev];
      const targetIndex = direction === "up" ? index - 1 : index + 1;

      if (targetIndex >= 0 && targetIndex < newItems.length) {
        [newItems[index], newItems[targetIndex]] = [
          newItems[targetIndex],
          newItems[index],
        ];
        localStorage.setItem(
          "navItemOrder",
          JSON.stringify(newItems.map((i) => i.path)),
        );
        return newItems;
      }
      return prev;
    });
  };

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <SidebarProvider
      defaultOpen={getInitialSidebarOpen()}
      className="flex min-h-screen overflow-hidden"
      style={{ height: "var(--app-vh, 100dvh)" }}
    >
      <Sidebar
        side="left"
        collapsible="icon"
        className="border-r border-sidebar-border/80 shadow-sm"
      >
        <AppSidebarContent
          navItems={navItems}
          isActive={isActive}
          company={company}
          user={user}
          onNavClick={() => { }}
          onReorder={handleReorder}
          theme={theme}
          toggleTheme={toggleTheme}
          handleLogout={handleLogout}
          onSearchOpen={() => setSearchOpen(true)}
          shortcutsOpen={shortcutsOpen}
          setShortcutsOpen={setShortcutsOpen}
        />
        <SidebarRail />
      </Sidebar>
      <div className="flex min-h-0 min-w-0 flex-1 bg-muted/20">
        {/* Main Content */}
        <main
          className={cn(
            "relative flex flex-1 min-h-0 flex-col overflow-x-hidden",
            isShellManagedRoute ? "overflow-y-hidden" : "overflow-y-auto",
          )}
          style={{
            overscrollBehavior: "contain",
            WebkitOverflowScrolling: "touch",
            scrollbarGutter: "stable both-edges",
          }}
        >
          {/* Mobile top bar — minimal, shows page title only */}
          <div className="sticky top-0 z-40 flex h-10 items-center border-b border-border/60 bg-background/95 px-3 backdrop-blur-sm lg:hidden">
            <p className="flex-1 truncate text-sm font-semibold text-foreground">
              {getMobileTitle(location.pathname)}
            </p>
            <button
              onClick={() => setSearchOpen(true)}
              aria-label="Search"
              className="mr-1 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
            >
              <Search className="h-4 w-4" />
            </button>
            <SidebarTrigger
              className="h-8 w-8 shrink-0 rounded-lg"
              aria-label="Open sidebar"
            />
          </div>

          {/* Page content — bottom padding for mobile nav */}
          <div className="mx-auto flex-1 min-h-0 w-full p-[8px] pb-[calc(env(safe-area-inset-bottom)+64px)] lg:p-[10px] lg:pb-0 lg:px-0">
            {!encInitDone ? (
              <div className="flex h-full min-h-[60dvh] flex-col items-center justify-center gap-3 text-muted-foreground">
                <Loader2 className="h-7 w-7 animate-spin" />
                <p className="text-sm">Loading…</p>
              </div>
            ) : (
              <div
                className={cn(
                  "h-full min-h-0 rounded-[28px] sm:p-3 md:p-4",
                  isShellManagedRoute &&
                  "border-0 bg-transparent p-0 shadow-none",
                )}
              >
                {children}
              </div>
            )}
          </div>

          <OverdueBillsDialog open={overdueOpen} onClose={() => setOverdueOpen(false)} />

          {/* ── Mobile Bottom Navigation ── */}
          <nav
            className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/80 bg-background/95 backdrop-blur-md lg:hidden"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <div className="flex items-stretch">
              {bottomPrimaryNav.map((item) => {
                const Icon = item.icon;
                const active =
                  item.path === "/"
                    ? location.pathname === "/"
                    : location.pathname.startsWith(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-colors",
                      active ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-5 w-5",
                        active && "scale-110 transition-transform",
                      )}
                    />
                    <span
                      className={cn(
                        "text-[10px] font-medium leading-none",
                        active && "font-semibold",
                      )}
                    >
                      {item.label}
                    </span>
                    {active && (
                      <span className="absolute bottom-0 h-0.5 w-8 rounded-full bg-primary" />
                    )}
                  </Link>
                );
              })}
              {/* More button */}
              <button
                onClick={() => setShowMoreSheet(true)}
                className={cn(
                  "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-colors",
                  bottomMoreNav.some((i) =>
                    location.pathname.startsWith(i.path),
                  )
                    ? "text-primary"
                    : "text-muted-foreground",
                )}
              >
                <MoreHorizontal className="h-5 w-5" />
                <span className="text-[10px] font-medium leading-none">
                  More
                </span>
              </button>
            </div>
          </nav>

          {/* ── More Sheet ── */}
          {showMoreSheet && (
            <div
              className="fixed inset-0 z-[60] lg:hidden"
              onClick={() => setShowMoreSheet(false)}
            >
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
              <div
                className="absolute bottom-0 left-0 right-0 rounded-t-2xl border-t border-border/80 bg-background p-4"
                style={{
                  paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted-foreground/30" />
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  More
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {bottomMoreNav.map((item) => {
                    const Icon = item.icon;
                    const active = location.pathname.startsWith(item.path);
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setShowMoreSheet(false)}
                        className={cn(
                          "flex flex-col items-center gap-1.5 rounded-xl p-2.5 transition-colors",
                          active
                            ? "bg-primary/10 text-primary"
                            : "bg-muted/50 text-foreground hover:bg-muted",
                        )}
                      >
                        <Icon className="h-5 w-5" />
                        <span className="text-[10px] font-medium leading-none text-center">
                          {item.label}
                        </span>
                      </Link>
                    );
                  })}
                </div>
                {/* Theme + Logout in sheet */}
                <div className="mt-4 flex gap-2 border-t border-border/60 pt-4">
                  <button
                    onClick={toggleTheme}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-muted/50 p-2.5 text-sm font-medium"
                  >
                    {theme === "light" ? (
                      <Moon className="h-4 w-4" />
                    ) : (
                      <Sun className="h-4 w-4" />
                    )}
                    {theme === "light" ? "Dark" : "Light"}
                  </button>
                  <button
                    onClick={handleLogout}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-destructive/10 p-2.5 text-sm font-medium text-destructive"
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
      <IBallAI />
    </SidebarProvider>
  );
}
