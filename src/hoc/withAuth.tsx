"use client";

import { useAuth } from "@/context/AuthContex";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function withAuth(Component: React.ComponentType) {
  return function AuthenticatedComponent(props: any) {
    const { user, loading } = useAuth();
    const [ready, setReady] = useState(false);
    const router = useRouter();

    useEffect(() => {
      if (!loading) setReady(true);
    }, [loading]);

    if (!ready) {
      return <div className="p-4">Yükleniyor...</div>;
    }

    if (!user) {
      return (
        <div className="p-4 text-center text-red-600 font-semibold">
          Bu sayfayı görmek için giriş yapmalısınız.
        </div>
      );
    }

    return <Component {...props} />;
  };
}
