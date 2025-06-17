"use client";

import { useState, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { useXsrStore } from "@/stores/xsrStore";
import { handleCreateProject } from "@/api/handlers";
import { Part, Assembly, Project } from "@/types/types";

export default function CreateProjectForm() {
  const router = useRouter();
  const { parsedData } = useXsrStore();
  const [projectName, setProjectName] = useState("");
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [parcaFiles, setParcaFiles] = useState<FileList | null>(null);
  const [birlesimFiles, setBirlesimFiles] = useState<FileList | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsedData) return;

    try {
      setLoading(true);

      // Tüm parçaları topla
      const allParts: Part[] = [];
      const assemblies: Record<string, Assembly> = {};

      console.log("Initial parsedData:", parsedData);

      // Her assembly için işlem yap
      Object.entries(parsedData).forEach(([assemblyId, assemblyData]) => {
        if (assemblyId === "parts") {
          // Ana parts array'ini işle
          const partsArray = assemblyData as unknown as Part[];
          partsArray.forEach(part => {
            allParts.push({
              ...part,
              defaultTasks: part.defaultTasks || {},
              assemblyTasks: part.assemblyTasks || {}
            });
          });
          return;
        }

        const assembly = assemblyData as Assembly;
        console.log(`Processing assembly ${assemblyId}:`, assembly);

        // Assembly'nin parçalarını işle
        const assemblyParts = (assembly.parts || []).map((part: Part) => {
          const processedPart = {
            ...part,
            defaultTasks: part.defaultTasks || {}, // Assembly parçalarının defaultTasks'ını koru
            assemblyTasks: {
              [assemblyId]: part.defaultTasks || {} // Assembly'ye özel taskları ekle
            }
          };
          console.log(`Processed part ${part.part}:`, processedPart);
          return processedPart;
        });

        // Assembly'yi kaydet
        assemblies[assemblyId] = {
          qty: assembly.qty,
          weight_kg: assembly.weight_kg,
          total_weight_kg: assembly.total_weight_kg,
          parts: assemblyParts,
          tasks: Object.keys(assemblyParts[0]?.defaultTasks || {})
        };

        console.log(`Saved assembly ${assemblyId}:`, assemblies[assemblyId]);

        // Parçaları ana listeye ekle
        assemblyParts.forEach((part: Part) => {
          const existingPart = allParts.find(p => p.part === part.part);
          if (existingPart) {
            // Eğer parça zaten varsa, assemblyTasks'ı güncelle
            existingPart.assemblyTasks = {
              ...existingPart.assemblyTasks,
              [assemblyId]: part.defaultTasks || {}
            };
          } else {
            // Yeni parça ekle
            allParts.push({
              ...part,
              assemblyTasks: {
                [assemblyId]: part.defaultTasks || {}
              }
            });
          }
        });
      });

      console.log("Final assemblies:", assemblies);
      console.log("Final allParts:", allParts);

      // Calculate total weight from assemblies
      const totalKg = Object.values(assemblies).reduce((sum, assembly) => {
        const weight = typeof assembly.total_weight_kg === 'string' 
          ? parseFloat(assembly.total_weight_kg) 
          : assembly.total_weight_kg || 0;
        return sum + weight;
      }, 0);

      const projectData: Omit<Project, "id"> = {
        projectName,
        total_kg: totalKg,
        projectStatus: "beklemede",
        createdAt: {
          seconds: Math.floor(Date.now() / 1000),
          nanoseconds: 0,
        },
        assemblies,
        parts: allParts,
        bolts: [],
        washers: [],
        nuts: []
      };

      console.log("Project data to be saved:", projectData);

      const result = await handleCreateProject(projectData, {
        coverImage: coverImage || undefined,
        parcaFiles: parcaFiles || undefined,
        birlesimFiles: birlesimFiles || undefined,
      });

      if (result.success) {
        router.push("/projects");
      } else {
        setError(result.error || "Proje oluşturulurken bir hata oluştu.");
      }
    } catch (error) {
      console.error("Error creating project:", error);
      setError("Proje oluşturulurken bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-md mx-auto mt-10 bg-white p-6 rounded shadow"
    >
      <h2 className="text-xl font-bold mb-4">Yeni Proje Oluştur</h2>

      <input
        type="text"
        placeholder="Proje ismi girin..."
        value={projectName}
        onChange={(e) => setProjectName(e.target.value)}
        className="w-full border p-2 rounded mb-4"
        required
      />

      <label className="block mb-2">Proje Kapak Resmi:</label>
      <input
        type="file"
        accept="image/*"
        onChange={(e) => setCoverImage(e.target.files?.[0] || null)}
        className="mb-4"
      />

      <label className="block mb-2">Parçalar PDF (çoklu seçim):</label>
      <input
        type="file"
        multiple
        accept="application/pdf"
        onChange={(e) => setParcaFiles(e.target.files)}
        className="mb-4"
      />

      <label className="block mb-2">Birleşimler PDF (çoklu seçim):</label>
      <input
        type="file"
        multiple
        accept="application/pdf"
        onChange={(e) => setBirlesimFiles(e.target.files)}
        className="mb-4"
      />

      <button
        type="submit"
        disabled={loading}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Kaydediliyor..." : "Projeyi Oluştur"}
      </button>

      {error && <p className="mt-4 text-red-600">{error}</p>}
    </form>
  );
}
