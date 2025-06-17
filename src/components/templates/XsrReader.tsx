"use client";

import { ChangeEvent } from "react";
import { useXsrStore } from "@/stores/xsrStore";

export default function XsrReaderAssemblies() {
  const { parsedData, setParsedData } = useXsrStore();

  const defaultTasks = {
    "Tedarik": { set: false, isDone: false },
    "Ölçü Kontrol": { set: false, isDone: false },
    "Malzemenin Temizligi": { set: false, isDone: false },
    "Kumlama": { set: false, isDone: false },
    "Birleştirme": { set: false, isDone: false },
    "Kaynak Temizligi": { set: false, isDone: false },
    "Astar": { set: false, isDone: false },
    "Boyama": { set: false, isDone: false },
    "Deliklerin Delinmesi": { set: false, isDone: false },
    "Deliklere Diş Açılması": { set: false, isDone: false },
    "Deliklere Havşa Uygulanması": { set: false, isDone: false },
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    console.log("📄 Reading XSR file:", file.name);

    const text = await file.text();
    const lines = text.split(/\r?\n/);

    console.log("📝 Total lines in file:", lines.length);

    let currentAssembly: string | null = null;
    const data: Record<string, any> = {
      parts: [], // Ana parts array'i
      total_kg: 0 // Toplam ağırlık
    };

    // Toplam ağırlığı bul
    const totalWeightMatch = text.match(/Total:\s*(\d+\.?\d*)/);
    if (totalWeightMatch) {
      data.total_kg = parseFloat(totalWeightMatch[1]);
      console.log("⚖️ Total weight found:", data.total_kg);
    }

    const isAssemblyLine = (line: string) => {
      const parts = line.trim().split(/\s{2,}|\t+/);
      return /^[A-ZÇŞĞİÖÜ0-9]+\/\d+\s+\d+/.test(line) && parts.length >= 2;
    };

    const isHeaderLine = (line: string) => {
      return (
        /^TEKLA STRUCTURES/i.test(line) ||
        /^TITLE:/i.test(line) ||
        /^Page:\s*\d+/i.test(line) ||
        /^Date:/i.test(line) ||
        /^PHASE:/i.test(line) ||
        /^Contract No:/i.test(line) ||
        /^[-]+$/.test(line) ||
        /^\s*$/.test(line) ||
        /^Standard\s+Site\/Shop/i.test(line)
      );
    };

    // Parçaları takip etmek için Map kullan
    const partsMap = new Map();

    lines.forEach((line, index) => {
      const trimmed = line.trim();

      if (!trimmed || isHeaderLine(trimmed)) {
        return;
      }

      if (isAssemblyLine(trimmed)) {
        const parts = trimmed.split(/\s{2,}|\t+/);
        const assemblyMatch = trimmed.match(/^([A-ZÇŞĞİÖÜ0-9]+\/\d+)\s+(\d+)/);
        if (assemblyMatch) {
          const [_, assemblyName, qty] = assemblyMatch;
          currentAssembly = assemblyName;
          const weight_kg = parts[parts.length - 1] || "";

          console.log(`🏗️ Found assembly: ${assemblyName} with quantity: ${qty}`);

          if (!data[currentAssembly]) {
            data[currentAssembly] = {
              qty,
              weight_kg,
              parts: [],
            };
          }
        }
        return;
      }

      if (!currentAssembly) return;

      const parts = trimmed.split(/\s{2,}|\t+/);

      if (parts[0]?.toLowerCase().startsWith("total")) {
        return; // Skip total lines
      }

      const assemblyQty = parseInt(data[currentAssembly].qty) || 1;
      const partObj: Record<string, any> = {
        part: (parts[0] || "").replace(/\//g, "-"),
        qty: assemblyQty.toString(),
        profile: parts[2] || "",
        grade: "",
        length_mm: "",
        weight_kg: "",
        assemblyInstances: {
          [currentAssembly]: Array.from({ length: assemblyQty }, (_, index) => ({
            id: index + 1,
            tasks: Object.keys(defaultTasks).reduce((acc, task) => ({
              ...acc,
              [task]: { set: false, isDone: false }
            }), {})
          }))
        }
      };

      // Skip header rows
      if (partObj.part === 'Assembly' || partObj.qty === 'NaN' || partObj.profile === 'No.') {
        return;
      }

      if (parts.length === 6) {
        partObj.grade = parts[3];
        partObj.length_mm = parts[4];
        partObj.weight_kg = parts[5];
      } else if (parts.length === 5) {
        partObj.length_mm = parts[3];
        partObj.weight_kg = parts[4];
      } else if (parts.length === 4) {
        partObj.weight_kg = parts[3];
      }

      console.log(`🔧 Found part: ${partObj.part} with quantity: ${partObj.qty}`);

      data[currentAssembly].parts.push(partObj);
      
      // Ana parts array'ine eklerken orijinal miktarı koru
      const mainPartObj = { ...partObj };
      
      // Skip header rows in main parts array
      if (mainPartObj.part === 'Assembly' || mainPartObj.qty === 'NaN' || mainPartObj.profile === 'No.') {
        return;
      }

      // Parçayı Map'e ekle veya güncelle
      if (partsMap.has(mainPartObj.part)) {
        const existingPart = partsMap.get(mainPartObj.part);
        // Sadece assembly instances'ları birleştir, miktarı değiştirme
        existingPart.assemblyInstances = {
          ...existingPart.assemblyInstances,
          ...mainPartObj.assemblyInstances
        };
        // Quantity'yi güncelle
        existingPart.qty = (parseInt(existingPart.qty) + parseInt(mainPartObj.qty)).toString();
        console.log(`🔄 Updated existing part: ${mainPartObj.part} with new quantity: ${existingPart.qty}`);
      } else {
        partsMap.set(mainPartObj.part, mainPartObj);
        console.log(`➕ Added new part: ${mainPartObj.part} with quantity: ${mainPartObj.qty}`);
      }
    });

    // Map'teki parçaları array'e dönüştür
    data.parts = Array.from(partsMap.values());

    console.log("📊 Final data structure:", {
      totalAssemblies: Object.keys(data).length - 2, // -2 for parts and total_kg
      totalParts: data.parts.length,
      totalWeight: data.total_kg
    });

    setParsedData(data);
  };

  const parseXsrFile = (content: string) => {
    const lines = content.split('\n');
    const assemblies: Record<string, any> = {};
    let currentAssembly: string | null = null;
    let isHeaderSection = true;

    for (const line of lines) {
      // Başlık bölümünü atla
      if (isHeaderSection) {
        if (line.includes('Assembly   Part        No.    Profile')) {
          isHeaderSection = false;
        }
        continue;
      }

      // Boş satırları ve ayraç çizgilerini atla
      if (!line.trim() || line.trim().startsWith('-')) {
        continue;
      }

      // Assembly satırını kontrol et
      const assemblyMatch = line.match(/^([A-Z0-9/]+)\s+(\d+)\s+([A-Z0-9.*]+)/);
      if (assemblyMatch) {
        currentAssembly = assemblyMatch[1];
        assemblies[currentAssembly] = {
          qty: assemblyMatch[2],
          profile: assemblyMatch[3],
          parts: []
        };
        continue;
      }

      // Parça satırını kontrol et
      if (currentAssembly) {
        const partMatch = line.match(/^\s*([A-Z0-9/]+)\s+(\d+)\s+([A-Z0-9.*]+)\s+([A-Z0-9]+)\s+(\d+)\s+([\d.]+)/);
        if (partMatch) {
          assemblies[currentAssembly].parts.push({
            part: partMatch[1],
            qty: partMatch[2],
            profile: partMatch[3],
            grade: partMatch[4],
            length_mm: partMatch[5],
            weight_kg: partMatch[6]
          });
        }
      }
    }

    return assemblies;
  };

  return (
    <div className="w-full">
      <input
        type="file"
        accept=".xsr,.txt"
        onChange={handleFileChange}
        className="w-full file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
      />
      {parsedData && (
        <pre className="mt-4 max-h-96 overflow-auto bg-gray-100 p-4 rounded text-sm">
          {JSON.stringify(parsedData, null, 2)}
        </pre>
      )}
    </div>
  );
}
