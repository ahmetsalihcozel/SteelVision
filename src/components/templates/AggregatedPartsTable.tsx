"use client";

import React, { useState, useMemo } from "react";
import { ParsedData, Part } from "@/types/types";

interface AggregatedPartsTableProps {
  data: ParsedData;
  onSaveTasks?: (updatedData: ParsedData) => void; // Firebase'e kaydetme callback'i
}

export default function AggregatedPartsTable({ data, onSaveTasks }: AggregatedPartsTableProps) {
  // Parçaları toplama ve aynı olanları birleştirme
  const partsMap = useMemo(() => {
    const map: Record<
      string,
      {
        part: string;
        profile: string;
        grade: string;
        length_mm: string;
        totalQty: number;
        totalWeight_kg: number;
        tasks: string[]; // toplamda atanan görevler
      }
    > = {};

    Object.values(data).forEach((assembly) => {
      assembly.parts.forEach((part) => {
        const key = part.part + "|" + part.profile + "|" + (part.grade || "");
        const qty = Number(part.qty) || 0;
        const weight = Number(part.weight_kg) || 0;

        if (!map[key]) {
          map[key] = {
            part: part.part,
            profile: part.profile,
            grade: part.grade,
            length_mm: part.length_mm,
            totalQty: qty,
            totalWeight_kg: weight * qty,
            tasks: part.tasks || [],
          };
        } else {
          map[key].totalQty += qty;
          map[key].totalWeight_kg += weight * qty;
          // Mevcut görevleri birleştir (unique)
          map[key].tasks = Array.from(new Set([...map[key].tasks, ...(part.tasks || [])]));
        }
      });
    });

    return map;
  }, [data]);

  const partsArray = Object.values(partsMap);

  // Checkbox ve görev seçimi için state
  const [selectedParts, setSelectedParts] = useState<Set<string>>(new Set());
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);

  // Parça seçimi toggle fonksiyonu
  const togglePart = (partKey: string) => {
    setSelectedParts((prev) => {
      const updated = new Set(prev);
      if (updated.has(partKey)) updated.delete(partKey);
      else updated.add(partKey);
      return updated;
    });
  };

  // Görev seçenekleri (örnek)
  const availableTasks = ["Kesilecek", "Delinecek", "Boyanacak"];

  // Görev checkbox toggle
  const toggleTask = (task: string) => {
    setSelectedTasks((prev) =>
      prev.includes(task) ? prev.filter((t) => t !== task) : [...prev, task]
    );
  };

  // Görev atama fonksiyonu
  const assignTasksToSelectedParts = () => {
    if (selectedParts.size === 0 || selectedTasks.length === 0) {
      alert("Lütfen en az bir parça ve görev seçin.");
      return;
    }

    // Yeni data yapısı için kopya
    const newData: ParsedData = JSON.parse(JSON.stringify(data));

    // Seçili parçalara görev ekle
    Object.values(newData).forEach((assembly) => {
      assembly.parts.forEach((part) => {
        const key = part.part + "|" + part.profile + "|" + (part.grade || "");
        if (selectedParts.has(key)) {
          // Görevleri birleştir, unique
          const existingTasks = part.tasks || [];
          const updatedTasks = Array.from(new Set([...existingTasks, ...selectedTasks]));
          part.tasks = updatedTasks;
        }
      });
    });

    // İstersen Firebase kaydetme fonksiyonunu çağır
    if (onSaveTasks) onSaveTasks(newData);

    // Seçimleri temizle
    setSelectedParts(new Set());
    setSelectedTasks([]);
  };

  if (partsArray.length === 0) return <p>Parça bulunamadı.</p>;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-4">Tüm Parçalar ve Görev Atama</h2>

      <div className="mb-4">
        <span className="mr-4 font-semibold">Görevler:</span>
        {availableTasks.map((task) => (
          <label key={task} className="mr-4">
            <input
              type="checkbox"
              checked={selectedTasks.includes(task)}
              onChange={() => toggleTask(task)}
              className="mr-1"
            />
            {task}
          </label>
        ))}
        <button
          onClick={assignTasksToSelectedParts}
          className="ml-4 px-3 py-1 bg-blue-600 text-white rounded disabled:opacity-50"
          disabled={selectedParts.size === 0 || selectedTasks.length === 0}
        >
          Görev Ata
        </button>
      </div>

      <table className="w-full text-left border-collapse border">
        <thead>
          <tr className="bg-gray-200">
            <th className="border px-2 py-1">Seç</th>
            <th className="border px-2 py-1">Parça</th>
            <th className="border px-2 py-1">Toplam Adet</th>
            <th className="border px-2 py-1">Profil</th>
            <th className="border px-2 py-1">Grade</th>
            <th className="border px-2 py-1">Uzunluk (mm)</th>
            <th className="border px-2 py-1">Toplam Ağırlık (kg)</th>
            <th className="border px-2 py-1">Görevler</th>
          </tr>
        </thead>
        <tbody>
          {partsArray.map((part, i) => {
            const key = part.part + "|" + part.profile + "|" + (part.grade || "");
            return (
              <tr key={i} className="even:bg-gray-50">
                <td className="border px-2 py-1 text-center">
                  <input
                    type="checkbox"
                    checked={selectedParts.has(key)}
                    onChange={() => togglePart(key)}
                  />
                </td>
                <td className="border px-2 py-1">{part.part}</td>
                <td className="border px-2 py-1">{part.totalQty}</td>
                <td className="border px-2 py-1">{part.profile}</td>
                <td className="border px-2 py-1">{part.grade}</td>
                <td className="border px-2 py-1">{part.length_mm}</td>
                <td className="border px-2 py-1">{part.totalWeight_kg.toFixed(2)}</td>
                <td className="border px-2 py-1">{part.tasks.join(", ") || "-"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
