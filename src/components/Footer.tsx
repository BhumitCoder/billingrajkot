import { Link } from "react-router-dom";
import { getCompanyProfile } from "@/lib/storage";
import { useEffect, useState } from "react";
import {
  FileText,
  Package,
  Users,
  Settings,
  Mail,
  Phone,
  MapPin,
  LayoutDashboard,
  ShoppingCart,
  RotateCcw,
  DollarSign,
  BookOpen,
  FolderOpen,
  StickyNote,
} from "lucide-react";

export function Footer() {
  const [company, setCompany] = useState<any>(null);

  useEffect(() => {
    const loadCompany = async () => {
      const companyData = await getCompanyProfile();
      setCompany(companyData);
    };
    loadCompany();
  }, []);

  return (
    <footer className="bg-card border-t border-border mt-auto w-full safe-area-inset-bottom">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 lg:py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-10 lg:gap-12">
          {/* Company Info */}
          <div className="space-y-4 lg:col-span-1">
            <div className="flex items-start gap-3">
              {company?.logo && (
                <img
                  src={company.logo}
                  alt="Logo"
                  className="h-10 w-10 sm:h-12 sm:w-12 object-contain flex-shrink-0 rounded-lg shadow-sm"
                />
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-lg sm:text-xl text-foreground break-words">
                  {company?.name || "Ibell"}
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  Invoice Management
                </p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Complete Invoice & Billing Management System for your business
            </p>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h4 className="font-semibold text-base text-foreground flex items-center gap-2">
              <LayoutDashboard className="h-4 w-4" />
              Quick Links
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <Link
                to="/"
                className="text-sm text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all flex items-center gap-2 px-3 py-2 rounded-lg"
              >
                <LayoutDashboard className="h-4 w-4 flex-shrink-0" />
                <span>Home</span>
              </Link>
              <Link
                to="/bills"
                className="text-sm text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all flex items-center gap-2 px-3 py-2 rounded-lg"
              >
                <FileText className="h-4 w-4 flex-shrink-0" />
                <span>Bills</span>
              </Link>
              <Link
                to="/purchases"
                className="text-sm text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all flex items-center gap-2 px-3 py-2 rounded-lg"
              >
                <ShoppingCart className="h-4 w-4 flex-shrink-0" />
                <span>Buy</span>
              </Link>
              <Link
                to="/returns"
                className="text-sm text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all flex items-center gap-2 px-3 py-2 rounded-lg"
              >
                <RotateCcw className="h-4 w-4 flex-shrink-0" />
                <span>Returns</span>
              </Link>
              <Link
                to="/passbook"
                className="text-sm text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all flex items-center gap-2 px-3 py-2 rounded-lg"
              >
                <BookOpen className="h-4 w-4 flex-shrink-0" />
                <span>Passbook</span>
              </Link>
              <Link
                to="/expenses"
                className="text-sm text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all flex items-center gap-2 px-3 py-2 rounded-lg"
              >
                <DollarSign className="h-4 w-4 flex-shrink-0" />
                <span>Expenses</span>
              </Link>
              <Link
                to="/products"
                className="text-sm text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all flex items-center gap-2 px-3 py-2 rounded-lg"
              >
                <Package className="h-4 w-4 flex-shrink-0" />
                <span>Stock</span>
              </Link>
              <Link
                to="/clients"
                className="text-sm text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all flex items-center gap-2 px-3 py-2 rounded-lg"
              >
                <Users className="h-4 w-4 flex-shrink-0" />
                <span>Clients</span>
              </Link>
              <Link
                to="/files"
                className="text-sm text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all flex items-center gap-2 px-3 py-2 rounded-lg"
              >
                <FolderOpen className="h-4 w-4 flex-shrink-0" />
                <span>Files</span>
              </Link>
              <Link
                to="/notes"
                className="text-sm text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all flex items-center gap-2 px-3 py-2 rounded-lg"
              >
                <StickyNote className="h-4 w-4 flex-shrink-0" />
                <span>Notesssss</span>
              </Link>
            </div>
          </div>

          {/* Contact Info */}
          <div className="space-y-4">
            <h4 className="font-semibold text-base text-foreground flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Contact Us
            </h4>
            <div className="space-y-3">
              {company?.phone && (
                <a
                  href={`tel:${company.phone}`}
                  className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all px-3 py-2 rounded-lg"
                >
                  <Phone className="h-4 w-4 flex-shrink-0" />
                  <span>{company.phone}</span>
                </a>
              )}
              {company?.email && (
                <a
                  href={`mailto:${company.email}`}
                  className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all px-3 py-2 rounded-lg break-all"
                >
                  <Mail className="h-4 w-4 flex-shrink-0" />
                  <span className="break-all">{company.email}</span>
                </a>
              )}
              {company?.address && (
                <div className="flex items-start gap-3 text-sm text-muted-foreground px-3 py-2 bg-muted/30 rounded-lg">
                  <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span className="break-words leading-relaxed">
                    {company.address}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Additional Links */}
          <div className="space-y-4">
            <h4 className="font-semibold text-base text-foreground flex items-center gap-2">
              <Settings className="h-4 w-4" />
              More
            </h4>
            <div className="space-y-2">
              <Link
                to="/settings"
                className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all px-3 py-2 rounded-lg"
              >
                <Settings className="h-4 w-4 flex-shrink-0" />
                <span>Settings</span>
              </Link>
              <Link
                to="/files"
                className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all px-3 py-2 rounded-lg"
              >
                <FolderOpen className="h-4 w-4 flex-shrink-0" />
                <span>Files</span>
              </Link>
              <Link
                to="/notes"
                className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all px-3 py-2 rounded-lg"
              >
                <StickyNote className="h-4 w-4 flex-shrink-0" />
                <span>Notesssss</span>
              </Link>
              <div className="mt-4 p-4 bg-muted/30 rounded-lg">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Manage your business efficiently with our comprehensive
                  billing solution
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-10 pt-8 border-t border-border">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground text-center sm:text-left">
              © {new Date().getFullYear()} {company?.name || "Ibell"}. All
              rights reserved.
            </p>
            <p className="text-sm text-muted-foreground text-center sm:text-right">
              Invoice & Billing Management System
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
