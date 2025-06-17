"use client";

import { ChangeEvent } from "react";
import { useXsrStore } from "@/stores/xsrStore";

export default function XsrReaderBolt() {
  const { parsedData, setParsedData } = useXsrStore();

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const lines = text.split(/\r?\n/);

    const bolts: any[] = [];
    const nuts: any[] = [];
    const washers: any[] = [];

    lines.forEach(line => {
      const trimmed = line.trim();
      
      // Skip header lines
      if (
        !trimmed ||
        trimmed.startsWith("---") ||
        trimmed.includes("Tekla Structures") ||
        trimmed.includes("PROJECT NUMBER") ||
        trimmed.includes("TITLE") ||
        trimmed.includes("PHASE") ||
        trimmed.includes("Date") ||
        trimmed.includes("Standard") ||
        trimmed.includes("Site/Shop")
      ) {
        return;
      }

      // Parse bolts
      const boltMatch = trimmed.match(/BOLT\s+(\d+\.\d+)\s+X\s+(\d+\.\d+)\s+(\d+)/);
      if (boltMatch) {
        const [_, diameter, length, quantity] = boltMatch;
        bolts.push({
          size: `M${diameter}X${length}`,
          quantity,
          name: "UNDEFINED_BOL"
        });
        return;
      }

      // Parse nuts
      const nutMatch = trimmed.match(/NUT\s+(\d+\.\d+)\s+(\d+)/);
      if (nutMatch) {
        const [_, diameter, quantity] = nutMatch;
        nuts.push({
          size: `M${diameter}`,
          quantity,
          name: "UNDEFINED_NUT"
        });
        return;
      }

      // Parse washers
      const washerMatch = trimmed.match(/WASHER\s+(\d+\.\d+)\s+(\d+)/);
      if (washerMatch) {
        const [_, diameter, quantity] = washerMatch;
        washers.push({
          size: `${diameter}mm`,
          quantity,
          name: "UNDEFINED_WASHER"
        });
      }
    });


    // Create new data object with fasteners, preserving existing assembly data
    const newData = {
      ...(parsedData || {}), // Keep existing assembly data
      "bolts": {
        qty: "1",
        weight_kg: "0",
        parts: bolts.map(bolt => ({
          part: bolt.size,
          qty: bolt.quantity,
          profile: "",
          weight_kg: "0",
          assemblyInstances: {}
        }))
      },
      "nuts": {
        qty: "1",
        weight_kg: "0",
        parts: nuts.map(nut => ({
          part: nut.size,
          qty: nut.quantity,
          profile: "",
          weight_kg: "0",
          assemblyInstances: {}
        }))
      },
      "washers": {
        qty: "1",
        weight_kg: "0",
        parts: washers.map(washer => ({
          part: washer.size,
          qty: washer.quantity,
          profile: "",
          weight_kg: "0",
          assemblyInstances: {}
        }))
      }
    };

    setParsedData(newData);
  };

  return (
    <div className="w-full">
      <input
        type="file"
        accept=".xsr,.txt"
        onChange={handleFileChange}
        className="w-full file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
      />
    </div>
  );
} 