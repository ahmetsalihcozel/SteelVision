import { useAuth } from "@/context/AuthContex";
import React, { ComponentType } from "react";

const withAdmin = <P extends object>(Component: ComponentType<P>) => {
  const AdminWrapper = (props: P) => {
    const { user, loading, isAdmin } = useAuth();

    if (loading) return <div>Yükleniyor...</div>;
    if (!user || !isAdmin) return <div>Yetkiniz yok.</div>;

    return <Component {...props} />;
  };

  return AdminWrapper;
};

export default withAdmin;
