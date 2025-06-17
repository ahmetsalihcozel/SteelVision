"use client"
import { useXsrStore } from "@/stores/xsrStore";

type TaskedPart = {
  part: string;
  qty: string;
  profile: string;
  grade: string;
  length_mm: string;
  weight_kg: string;
  tasks: string[];
};

type Assembly = {
  qty: string;
  weight_kg: string;
  parts: TaskedPart[];
};

type AssemblyData = {
  [assembly: string]: Assembly;
};

export default function AssemblyDisplay() {
  const { parsedData } = useXsrStore();

  if (!parsedData) {
    return <div className="p-4">Veri bulunamadı.</div>;
  }

  // Convert parsedData to AssemblyData format
  const assemblyData: AssemblyData = Object.entries(parsedData).reduce((acc, [assemblyName, assembly]) => {
    acc[assemblyName] = {
      qty: assembly.qty,
      weight_kg: assembly.weight_kg,
      parts: assembly.parts.map(part => ({
        ...part,
        tasks: part.defaultTasks ? Object.keys(part.defaultTasks) : []
      }))
    };
    return acc;
  }, {} as AssemblyData);

  return (
    <div className="p-4">
      {Object.entries(assemblyData).map(
        ([assemblyName, assembly]: [string, Assembly]) => (
          <div key={assemblyName} className="mb-6 p-4 border rounded shadow bg-gray-50">
            <h3 className="text-xl font-bold mb-2">Birleşim: {assemblyName}</h3>
            <p className="mb-2">Adet: {assembly.qty} | Ağırlık: {assembly.weight_kg} kg</p>
            {assembly.parts.map((part: TaskedPart, index: number) => (
              <div key={index} className="p-3 mb-3 border rounded bg-white">
                <p className="font-semibold">Parça No: {part.part}</p>
                <p>
                  Profil: {part.profile} | Boy: {part.length_mm} mm | Ağırlık: {part.weight_kg} kg
                </p>
                <div className="mt-2">
                  <p className="font-semibold">Görevler:</p>
                  <ul className="list-disc list-inside text-sm">
                    {part.tasks?.map((task: string, i: number) => (
                      <li key={i}>{task}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
