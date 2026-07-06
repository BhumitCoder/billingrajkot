import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { EncryptionLockProvider } from "@/contexts/EncryptionLockContext";
import { Layout } from "@/components/Layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import Dashboard from "@/pages/Dashboard";
import Bills from "@/pages/Bills";
import CreateBill from "@/pages/CreateBill";
import EditBill from "@/pages/EditBill";
import BillDetail from "@/pages/BillDetail";
import Products from "@/pages/Products";
import Clients from "@/pages/Clients";
import Settings from "@/pages/Settings";
import Auth from "@/pages/Auth";
import NotFound from "@/pages/NotFound";
import BillViewPublic from "@/pages/BillViewPublic";
import PurchaseBills from "@/pages/PurchaseBills";
import Returns from "@/pages/Returns";
import Expenses from "@/pages/Expenses";
import Passbook from "@/pages/Passbook";
import Files from "@/pages/Files";
import Notes from "@/pages/Notes";
import Vendors from "@/pages/Vendors";
import Calculator from "@/pages/Calculator";
import SampleBill from "@/pages/SampleBill";
import BillCreators from "@/pages/BillCreators";
import BankAccounts from "@/pages/BankAccounts";
import ExpoDashboard from "@/pages/Expo/ExpoDashboard";
import AIAgent from "@/pages/AIAgent";
import BusinessHealth from "@/pages/BusinessHealth";
import IMEITimeline from "@/pages/IMEITimeline";
import Report from "@/pages/Report";
import StockAudit from "@/pages/StockAudit";
import { LoadingSpinner } from "./components/LoadingSpinner";
import { Suspense } from "react";
import { SampleBillForm } from "./components/SampleBillForm";
import { SampleBillViewPage } from "./components/SampleBillViewPage";
import { SampleBillEditPage } from "./components/SampleBillEditPage";
import SampleBills from "@/pages/SampleBill";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <ThemeProvider>
        <EncryptionLockProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <PWAInstallPrompt />
          <Routes>
            <Route path="/auth" element={<Auth />} />
            {/* Public bill view for QR scanning - no auth required */}
            <Route path="/view/bill/:id" element={<BillViewPublic />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/bills" element={<Bills />} />
                      <Route path="/sample-bill" element={<SampleBill />} />
                      <Route path="/bills/new" element={<CreateBill />} />
                      <Route path="/bills/:id" element={<BillDetail />} />
                      <Route path="/bills/:id/edit" element={<EditBill />} />
                      <Route path="/purchases" element={<PurchaseBills />} />
                      <Route path="/returns" element={<Returns />} />
                      <Route path="/passbook" element={<Passbook />} />
                      <Route path="/expenses" element={<Expenses />} />
                      <Route path="/products" element={<Products />} />
                      <Route path="/clients" element={<Clients />} />
                      <Route path="/vendors" element={<Vendors />} />
                      <Route path="/imei-timeline" element={<IMEITimeline />} />
                      <Route path="/stock-audit" element={<StockAudit />} />
                      <Route path="/report" element={<Report />} />
                      <Route path="/settings" element={<Settings />} />
                      <Route path="/files" element={<Files />} />
                      <Route path="/notes" element={<Notes />} />
                      <Route path="/calculator" element={<Calculator />} />
                      <Route path="/bank-accounts" element={<BankAccounts />} />
                      <Route path="/bill-creators" element={<BillCreators />} />
                      <Route path="/expo-dashboard/:expoId" element={<ExpoDashboard />} />
                      <Route path="/ai-agent" element={<AIAgent />} />
                      <Route path="/business-health" element={<BusinessHealth />} />
                      <Route path="*" element={<NotFound />} />
                      <Route path="/sample-bills" element={<SampleBills />} />
                      <Route
                        path="/sample-bills/new"
                        element={<SampleBillForm />}
                      />
                      <Route
                        path="/sample-bills/:id"
                        element={
                          <Suspense fallback={<LoadingSpinner fullScreen contentAreaOnly />}>
                            <SampleBillViewPage />
                          </Suspense>
                        }
                      />
                      <Route
                        path="/sample-bills/:id/edit"
                        element={
                          <Suspense fallback={<LoadingSpinner fullScreen contentAreaOnly />}>
                            <SampleBillEditPage />
                          </Suspense>
                        }
                      />
                    </Routes>
                  </Layout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </TooltipProvider>
        </EncryptionLockProvider>
      </ThemeProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
