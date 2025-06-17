"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { handleCreateProject } from "@/api/handlers";
import { useAuth } from "@/context/AuthContex";
import { ProjectStatus, Assembly, Part } from "@/types/types";
import { useXsrStore } from "@/stores/xsrStore";
import XsrReaderAssemblies from "@/components/templates/XsrReader";
import XsrReaderBolt from "@/components/templates/XsrReaderBolt";

export default function CreateProjectPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { parsedData, setParsedData } = useXsrStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    projectName: "",
    total_kg: "",
    projectStatus: "beklemede" as ProjectStatus,
    assemblies: {} as Record<string, Assembly>,
    parts: [] as Part[],
  });
  const [files, setFiles] = useState({
    coverImage: undefined as File | undefined,
    parcaFiles: undefined as FileList | undefined,
    birlesimFiles: undefined as FileList | undefined,
    boltXsrFile: undefined as File | undefined,
    assemblyXsrFile: undefined as File | undefined,
  });

  useEffect(() => {
    if (parsedData) {
      console.log('XSR Parsed Data:', parsedData);
      
      // XSR'den gelen toplam ağırlığı kullan
      if (parsedData.total_kg) {
        setFormData(prev => ({
          ...prev,
          total_kg: parsedData.total_kg.toString()
        }));
      }
    }
  }, [parsedData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !parsedData) {
      setError("Lütfen giriş yapın ve XSR dosyasını yükleyin.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const bolts = parsedData.bolts?.parts.map(part => ({
        size: part.part,
        qty: part.qty,
        name: part.profile
      })) || [];
      const washers = parsedData.washers?.parts.map(part => ({
        size: part.part,
        qty: part.qty,
        name: part.profile
      })) || [];
      const nuts = parsedData.nuts?.parts.map(part => ({
        size: part.part,
        qty: part.qty,
        name: part.profile
      })) || [];

      const { bolts: _, washers: __, nuts: ___, ...restParsedData } = parsedData;

      console.log("🔍 Initial parsedData:", parsedData);
      console.log("🔍 Rest parsedData:", restParsedData);

      const projectData = {
        projectName: formData.projectName,
        total_kg: parseFloat(formData.total_kg),
        projectStatus: formData.projectStatus,
        createdAt: {
          seconds: Math.floor(Date.now() / 1000),
          nanoseconds: 0
        },
        assemblies: Object.entries(restParsedData)
          .filter(([key, value]) => {
            return key !== "parts" && key !== "total_kg" && value && typeof value === "object";
          })
          .reduce((acc, [key, value]) => {
            return {
              ...acc,
              [key]: {
                ...value,
                parts: Array.isArray(value.parts) ? value.parts.map(part => ({
                  ...part,
                  assemblyInstances: part.assemblyInstances || {}
                })) : []
              }
            };
          }, {}),
        parts: Object.values(restParsedData)
          .filter(assembly => {
            return assembly && Array.isArray(assembly.parts);
          })
          .flatMap(assembly => {
            return assembly.parts;
          })
          .reduce((uniqueParts: Part[], part) => {
            const existingPartIndex = uniqueParts.findIndex(p => p.part === part.part);
            if (existingPartIndex === -1) {
              uniqueParts.push({
              ...part,
              assemblyInstances: part.assemblyInstances || {}
              });
            } else {
              uniqueParts[existingPartIndex].assemblyInstances = {
                ...uniqueParts[existingPartIndex].assemblyInstances,
                ...part.assemblyInstances
            };
            }
            return uniqueParts;
          }, []),
        bolts,
        washers,
        nuts
      };

      console.log("📦 Project data before handleCreateProject:", projectData);

      const result = await handleCreateProject(
        projectData,
        files
      );

      if (result.success && result.projectId) {
        router.push(`/projects/${result.projectId}`);
      } else {
        console.error("❌ Project creation failed:", result.error);
        setError(result.error || "Proje oluşturulurken bir hata oluştu.");
      }
    } catch (err) {
      console.error("❌ Error in handleSubmit:", err);
      setError("Proje oluşturulurken bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, files: newFiles } = e.target;
    
    if (name === "coverImage" || name === "boltXsrFile" || name === "assemblyXsrFile") {
      setFiles(prev => ({
        ...prev,
        [name]: newFiles?.[0] || undefined
      }));

    } else {
      setFiles(prev => ({
        ...prev,
        [name]: newFiles
      }));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">
            Yeni Proje Oluştur
          </h1>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Proje Adı */}
            <div>
              <label htmlFor="projectName" className="block text-sm font-medium text-gray-700 mb-1">
                Proje Adı
              </label>
              <input
                type="text"
                id="projectName"
                value={formData.projectName}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, projectName: e.target.value }))
                }
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="Proje adını girin"
              />
            </div>

            {/* Toplam Ağırlık */}
            <div>
              <label htmlFor="total_kg" className="block text-sm font-medium text-gray-700 mb-1">
                Toplam Ağırlık (kg)
              </label>
              <input
                type="number"
                id="total_kg"
                value={formData.total_kg}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, total_kg: e.target.value }))
                }
                required
                step="0.01"
                min="0"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="0.00"
              />
            </div>

            {/* Proje Durumu */}
            <div>
              <label htmlFor="projectStatus" className="block text-sm font-medium text-gray-700 mb-1">
                Proje Durumu
              </label>
              <select
                id="projectStatus"
                value={formData.projectStatus}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    projectStatus: e.target.value as "beklemede" | "devam ediyor" | "bitti",
                  }))
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              >
                <option value="beklemede">Beklemede</option>
                <option value="devam ediyor">Devam Ediyor</option>
                <option value="bitti">Bitti</option>
              </select>
            </div>

            {/* Kapak Görseli */}
            <div>
              <label htmlFor="coverImage" className="block text-sm font-medium text-gray-700 mb-1">
                Kapak Görseli
              </label>
              <input
                type="file"
                id="coverImage"
                name="coverImage"
                accept="image/*"
                onChange={handleFileChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>

            {/* Parça Dosyaları */}
            <div>
              <label htmlFor="parcaFiles" className="block text-sm font-medium text-gray-700 mb-1">
                Parça Dosyaları
              </label>
              <input
                type="file"
                id="parcaFiles"
                name="parcaFiles"
                multiple
                onChange={handleFileChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>

            {/* Birleşim Dosyaları */}
            <div>
              <label htmlFor="birlesimFiles" className="block text-sm font-medium text-gray-700 mb-1">
                Birleşim Dosyaları
              </label>
              <input
                type="file"
                id="birlesimFiles"
                name="birlesimFiles"
                multiple
                onChange={handleFileChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>

            {/* Cıvata XSR Dosyası */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cıvata XSR Dosyası
              </label>
              <div className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors">
                <XsrReaderBolt />
              </div>
            </div>

            {/* XSR Reader */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Birleşim Listesi XSR Dosyası
              </label>
              <div className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors">
                <XsrReaderAssemblies />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Oluşturuluyor..." : "Proje Oluştur"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
