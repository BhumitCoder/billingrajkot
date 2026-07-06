import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Lock, Users, Eye, EyeOff } from "lucide-react";
import { setUserPreference, getCreators, getCompanyProfile } from "@/lib/storage";
import {
  getActiveSessionCount,
  registerSession,
  removeSession,
  refreshSession,
} from "@/lib/firebaseService";
import { clearEncryptionKey } from "@/lib/crypto";
import { BillCreator } from "@/types";
import {
  signInWithEmailAndPassword,
  signInAnonymously,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

const AUTH_KEY = "authenticated";
const SESSION_EXPIRY_KEY = "sessionExpiry";
const USER_ROLE_KEY = "userRole";
const USER_NAME_KEY = "userName";
const USER_PERMISSIONS_KEY = "userPermissions";
const SESSION_ID_KEY = "sessionId";
const SESSION_DURATION = 365 * 24 * 60 * 60 * 1000;

let _sessionRefreshInterval: ReturnType<typeof setInterval> | null = null;

const generateSessionId = () =>
  `session_${Date.now()}_${Math.random().toString(36).slice(2)}`;

export default function Auth() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showLimitDialog, setShowLimitDialog] = useState(false);
  const [company, setCompany] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Load company profile — fails gracefully if rules block unauthenticated reads
    getCompanyProfile().then(setCompany).catch(() => {});

    // If already signed in to Firebase, check if app session is valid
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe();
      if (user && localStorage.getItem(USER_ROLE_KEY)) {
        const params = new URLSearchParams(window.location.search);
        navigate(params.get("from") || "/", { replace: true });
      }
    });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const isEmail = identifier.includes("@");
      let role = "";
      let name = "";
      let permissions: string[] = [];

      if (isEmail) {
        // Admin: Firebase email + password
        await signInWithEmailAndPassword(auth, identifier, password);
        role = "admin";
        name = "Admin";
      } else {
        // Creator: sign in anonymously to read Firestore, then validate credentials
        await signInAnonymously(auth);
        const creators = await getCreators();
        const creator = creators.find(
          (c: BillCreator) =>
            c.name.toLowerCase() === identifier.toLowerCase() &&
            c.password === password,
        );
        if (!creator) {
          await signOut(auth);
          toast.error("Invalid credentials. Please check your username and password.");
          return;
        }
        role = "creator";
        name = creator.name;
        permissions = creator.permissions || [];
      }

      const activeCount = await getActiveSessionCount();
      if (activeCount >= 100) {
        await signOut(auth);
        setShowLimitDialog(true);
        return;
      }

      await loginUser(role, name, permissions);
    } catch (err: any) {
      const code = err?.code ?? "";
      const message = err?.message ?? "";
      if (code === "auth/user-not-found" || code === "auth/wrong-password" || code === "auth/invalid-credential" || code === "auth/invalid-email") {
        toast.error("Invalid email or password.");
      } else if (code === "auth/too-many-requests") {
        toast.error("Too many attempts. Please try again later.");
      } else if (code === "auth/network-request-failed") {
        toast.error("Network error. Check your internet connection.");
      } else if (code === "auth/operation-not-allowed") {
        toast.error("This sign-in method is not enabled in Firebase Console.");
      } else {
        toast.error(`Login failed: ${code || message || "unknown error"}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const loginUser = async (role: string, name: string, permissions: string[]) => {
    const sessionId = generateSessionId();
    localStorage.setItem(AUTH_KEY, "true");
    localStorage.setItem(SESSION_EXPIRY_KEY, (Date.now() + SESSION_DURATION).toString());
    localStorage.setItem(USER_ROLE_KEY, role);
    localStorage.setItem(USER_NAME_KEY, name);
    localStorage.setItem(USER_PERMISSIONS_KEY, permissions.join(","));
    localStorage.setItem(SESSION_ID_KEY, sessionId);
    await registerSession(sessionId, name, role);
    if (_sessionRefreshInterval) clearInterval(_sessionRefreshInterval);
    _sessionRefreshInterval = setInterval(() => refreshSession(sessionId), 10 * 60 * 1000);
    toast.success(`Welcome back, ${name}!`);
    navigate("/");
  };

  return (
    <>
      <Dialog open={showLimitDialog} onOpenChange={setShowLimitDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center justify-center mb-3">
              <div className="h-14 w-14 rounded-full bg-destructive/10 flex items-center justify-center">
                <Users className="h-7 w-7 text-destructive" />
              </div>
            </div>
            <DialogTitle className="text-center text-xl">Login Limit Reached</DialogTitle>
            <DialogDescription className="text-center text-base pt-1">
              Maximum <span className="font-semibold text-foreground">3 active users</span> are already logged in.
              <br />
              Please logout from one of the logged-in devices to continue.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2">
            <Button className="w-full" variant="outline" onClick={() => setShowLimitDialog(false)}>
              OK, Got It
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="min-h-screen bg-gradient-to-br from-primary/20 via-background to-accent/20 flex items-center justify-center p-3 sm:p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            {company?.logo && (
              <img src={company.logo} alt="Company Logo" className="h-16 md:h-20 mx-auto object-contain mb-4" />
            )}
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">
              {company?.name || "Ibell"}
            </h1>
            <p className="text-muted-foreground">Invoice Management System</p>
          </div>

          <Card className="shadow-xl">
            <CardHeader className="space-y-1">
              <div className="flex items-center justify-center mb-2">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Lock className="h-6 w-6 text-primary" />
                </div>
              </div>
              <CardTitle className="text-2xl text-center">Welcome Back</CardTitle>
              <CardDescription className="text-center">
                Enter your credentials to access your account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="identifier">Email or Username</Label>
                  <Input
                    id="identifier"
                    type="text"
                    placeholder="admin@example.com or username"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    required
                    disabled={loading}
                    autoFocus
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Admin: use email address · Staff: use your name
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button type="submit" className="w-full" size="lg" loading={loading}>
                  {loading ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground">
            Secure and reliable billing management
          </p>
        </div>
      </div>
    </>
  );
}

// Firebase is the source of truth for auth state
export const isAuthenticated = (): Promise<boolean> => {
  return new Promise((resolve) => {
    // Already have a user (post-login or warm page)
    if (auth.currentUser) {
      resolve(!!localStorage.getItem(USER_ROLE_KEY));
      return;
    }
    // Wait for Firebase to restore persisted session on cold page load
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      if (user && localStorage.getItem(USER_ROLE_KEY)) {
        resolve(true);
      } else {
        if (!user) {
          localStorage.removeItem(AUTH_KEY);
          localStorage.removeItem(SESSION_EXPIRY_KEY);
          localStorage.removeItem(USER_ROLE_KEY);
          localStorage.removeItem(USER_NAME_KEY);
          localStorage.removeItem(USER_PERMISSIONS_KEY);
          clearEncryptionKey();
        }
        resolve(false);
      }
    });
  });
};

export const logout = async (): Promise<void> => {
  const sessionId = localStorage.getItem(SESSION_ID_KEY);
  // Firestore writes must happen before signOut (rules require auth token)
  if (sessionId) await removeSession(sessionId).catch(() => {});
  try { await setUserPreference(AUTH_KEY, "false"); } catch { /* best-effort */ }
  await signOut(auth).catch(() => {});
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(SESSION_EXPIRY_KEY);
  localStorage.removeItem(USER_ROLE_KEY);
  localStorage.removeItem(USER_NAME_KEY);
  localStorage.removeItem(USER_PERMISSIONS_KEY);
  localStorage.removeItem(SESSION_ID_KEY);
  clearEncryptionKey();
};

// Sync check used by ProtectedRoute — Firebase currentUser + localStorage fallback during init
export const checkSessionExpiry = (): boolean =>
  auth.currentUser !== null || !!localStorage.getItem(USER_ROLE_KEY);

export const getCurrentUser = () => ({
  role: localStorage.getItem(USER_ROLE_KEY),
  name: localStorage.getItem(USER_NAME_KEY),
});
