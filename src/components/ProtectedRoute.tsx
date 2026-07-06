import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { isAuthenticated, checkSessionExpiry } from '@/pages/Auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const location = useLocation();

  useEffect(() => {
    const checkAuth = async () => {
      // Check session expiry first (synchronous check)
      if (!checkSessionExpiry()) {
        setAuthenticated(false);
        return;
      }
      
      // Then verify full authentication
      const auth = await isAuthenticated();
      setAuthenticated(auth);
    };
    
    checkAuth();
    
    // Check session on route changes
    const interval = setInterval(() => {
      if (!checkSessionExpiry()) {
        setAuthenticated(false);
      }
    }, 60000); // Check every minute
    
    return () => clearInterval(interval);
  }, [location]);

  if (authenticated === null) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  // Allow public bill view without authentication
  if (location.pathname.startsWith('/view/bill/')) {
    return <>{children}</>;
  }

  if (!authenticated) {
    return <Navigate to={`/auth?from=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  return <>{children}</>;
}
