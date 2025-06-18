"use client";
import { createContext, useContext, useEffect, useState, Suspense } from "react";
import { onAuthStateChanged, User, signOut } from "firebase/auth";
import { auth, db } from "@/api/firebase";
import { doc, getDoc } from "firebase/firestore";
import { usePathname, useSearchParams } from "next/navigation";

type AuthContextType = {
  user: User | null;
  userData: { firstName: string; lastName: string; isAdmin: boolean } | null;
  loading: boolean;
  logout: () => Promise<void>;
  isAdmin: boolean;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  userData: null,
  loading: true,
  logout: async () => {},
  isAdmin: false,
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AuthProviderContent>{children}</AuthProviderContent>
    </Suspense>
  );
}

function AuthProviderContent({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<{ firstName: string; lastName: string; isAdmin: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        try {
          const userDocRef = doc(db, "users", user.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            const data = userDocSnap.data();
            setUserData({
              firstName: data.firstName,
              lastName: data.lastName,
              isAdmin: data.isAdmin
            });
            setIsAdmin(data.isAdmin);
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      } else {
        setUserData(null);
        setIsAdmin(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    try {
      await signOut(auth);

      setUser(null);
      setUserData(null);

      localStorage.removeItem('user');
      sessionStorage.clear();

      window.location.href = '/login';
    } catch (error) {
      console.error("❌ Çıkış yapılırken hata oluştu:", error);
      
      try {
        setUser(null);
        setUserData(null);
        localStorage.removeItem('user');
        sessionStorage.clear();
        
        window.location.href = '/login';
      } catch (cleanupError) {
      }
    }
  };

  return (
    <AuthContext.Provider value={{ user, userData, loading, logout, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}
