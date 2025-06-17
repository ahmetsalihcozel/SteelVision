"use client";
import { useXsrStore } from "@/stores/xsrStore";
import React, { useMemo, useState } from "react";
import Link from "next/link";
import PartFilter from "@/components/PartFilter";

export default function PlakalarPage() {
  const viewingProject = useXsrStore((state) => state.viewingProject);
  const [filters, setFilters] = useState({
    name: '',
    profile: '',
    grade: '',
    length: '',
    qty: '',
    weight: ''
  });

  const plakalar = useMemo(() => {
    if (!viewingProject?.parts) return [];

    return viewingProject.parts
      .filter((part) => {
        const profile = part.profile?.toUpperCase() || '';
        return profile.includes('PL') || profile.includes('PLATE');
      })
      .filter((part) => {
        if (filters.name && !part.part.toLowerCase().includes(filters.name.toLowerCase())) return false;
        if (filters.profile && !part.profile?.toLowerCase().includes(filters.profile.toLowerCase())) return false;
        if (filters.grade && !part.grade?.toLowerCase().includes(filters.grade.toLowerCase())) return false;
        if (filters.length && !part.length_mm?.includes(filters.length)) return false;
        if (filters.qty && !part.qty.includes(filters.qty)) return false;
        if (filters.weight && !part.weight_kg.includes(filters.weight)) return false;
        return true;
      });
  }, [viewingProject, filters]);

  if (!viewingProject) {
    return <p className="p-4 text-red-500">Proje bulunamadı.</p>;
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">Plakalar</h2>
      
      <PartFilter onFilterChange={setFilters} />

      {plakalar.length === 0 ? (
        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded">
          <p className="text-yellow-700">
            Arama kriterlerinize uygun plaka bulunamadı.
          </p>
        </div>
      ) : (
        <div className="mt-8 bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Plaka Listesi</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Parça</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Profil</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Kalite</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Uzunluk (mm)</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Adet</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Ağırlık (kg)</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">İşlemler</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {plakalar.map((part, index) => (
                  <tr key={`${part.part}-${index}`} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      <Link
                        href={`/projects/${viewingProject?.id || ''}/partDetail/${part.part}`}
                        className="text-blue-600 hover:underline"
                      >
                        {part.part}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{part.profile}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{part.grade}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{part.length_mm}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{part.qty}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{part.weight_kg}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">
                      <Link
                        href={`/projects/${viewingProject?.id || ''}/partDetail/${part.part}`}
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
      )}
    </div>
  );
}
