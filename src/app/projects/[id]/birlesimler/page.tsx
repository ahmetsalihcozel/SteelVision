"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useXsrStore } from "@/stores/xsrStore";
import Link from "next/link";

export default function BirlesimlerPage() {
  const router = useRouter();
  const viewingProject = useXsrStore((state) => state.viewingProject);
  const [filters, setFilters] = useState({
    name: '',
    profile: '',
    length: '',
    qty: '',
    weight: ''
  });

  const birlesimler = useMemo(() => {
    if (!viewingProject?.assemblies) return [];

    return Object.entries(viewingProject.assemblies)
      .map(([assemblyId, assembly]) => ({
        id: assemblyId,
        ...assembly
      }))
      .filter((assembly) => {
        if (filters.name && !assembly.id.toLowerCase().includes(filters.name.toLowerCase())) return false;
        if (filters.qty && !assembly.qty.includes(filters.qty)) return false;
        if (filters.weight && !assembly.weight_kg.includes(filters.weight)) return false;
        return true;
      });
  }, [viewingProject, filters]);

  useEffect(() => {
    if (!viewingProject) {
      router.push("/projects");
    }
  }, [viewingProject, router]);

  if (!viewingProject) {
    return (
      <div className="max-w-5xl mx-auto p-6 text-gray-800 italic">
        Yönlendiriliyor...
      </div>
    );
  }

  if (!viewingProject.assemblies || Object.keys(viewingProject.assemblies).length === 0) {
    return (
      <div className="max-w-5xl mx-auto p-6 text-gray-800 italic">
        Bu projede montaj (assemblies) verisi bulunamadı.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{viewingProject.projectName} - Birleşimler</h1>
          <div className="flex gap-4 mt-4">
            <Link href={`/projects/${viewingProject.id}`} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
              Projeye Dön
            </Link>
          </div>
        </div>

        <div className="mt-8 bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Birleşim Listesi</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Birleşim</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Adet</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Ağırlık (kg)</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">İşlemler</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {birlesimler.map((assembly, index) => (
                  <tr key={`${assembly.id}-${index}`} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      <Link
                        href={`/projects/${viewingProject?.id || ''}/assemblyDetail/${assembly.id.replace(/\//g, "-")}`}
                        className="text-blue-600 hover:underline"
                      >
                        {assembly.id}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{assembly.qty}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{assembly.weight_kg}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">
                      <Link
                        href={`/projects/${viewingProject?.id || ''}/assemblyDetail/${assembly.id.replace(/\//g, "-")}`}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        Detay
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
