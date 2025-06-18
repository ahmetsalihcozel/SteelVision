"use client";
import { useXsrStore } from "@/stores/xsrStore";
import { Part } from "@/types/types";
import React, { useMemo, useEffect, useState } from "react";
import Link from "next/link";
import PartFilter from "@/components/PartFilter";

export default function TumParcalarPage() {
  const viewingProject = useXsrStore((state) => state.viewingProject);
  const [filters, setFilters] = useState({
    name: '',
    profile: '',
    grade: '',
    length: '',
    weight: ''
  });

  useEffect(() => {
    console.log(viewingProject)
  }, [viewingProject]);

  const allParts = useMemo(() => {
    if (!viewingProject?.parts) return [];

    const partMap = new Map<string, Part>();
    viewingProject.parts.forEach((part) => {
      if (partMap.has(part.part)) {
        const existingPart = partMap.get(part.part)!;
        existingPart.qty = (parseInt(existingPart.qty) + parseInt(part.qty)).toString();
        existingPart.assemblyInstances = {
          ...existingPart.assemblyInstances,
          ...part.assemblyInstances
        };
      } else {
        partMap.set(part.part, { ...part });
      }
    });

    return Array.from(partMap.values());
  }, [viewingProject]);

  const tumParcalar = useMemo(() => {
    if (!viewingProject?.parts) return [];

    return allParts.filter((part) => {
      if (filters.name && !part.part.toLowerCase().includes(filters.name.toLowerCase())) return false;
      if (filters.profile && !part.profile?.toLowerCase().includes(filters.profile.toLowerCase())) return false;
      if (filters.grade && !part.grade?.toLowerCase().includes(filters.grade.toLowerCase())) return false;
      if (filters.length && !part.length_mm?.toString().includes(filters.length)) return false;
      if (filters.weight && !part.weight_kg?.toString().includes(filters.weight)) return false;
      return true;
    });
  }, [allParts, filters]);

  if (!viewingProject) {
    return <p className="p-4 text-red-500">Proje bulunamadı.</p>;
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">Tüm Parçalar</h2>
      
      <PartFilter onFilterChange={setFilters} />

      {tumParcalar.length === 0 ? (
        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded">
          <p className="text-yellow-700">
            Arama kriterlerinize uygun parça bulunamadı.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto mt-4">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Parça</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Profil</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Kalite</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Uzunluk (mm)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Adet</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Ağırlık (kg)</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tumParcalar.map((part, idx) => (
                <tr key={`${part.part}-${idx}`} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    <Link
                      href={`/projects/${viewingProject?.id || ''}/partDetail/${part.part}`}
                      className="text-blue-600 hover:underline"
                    >
                      {part.part}
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{part.profile || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{part.grade || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{part.length_mm || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{part.qty || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{part.weight_kg || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
