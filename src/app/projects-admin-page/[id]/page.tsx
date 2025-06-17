"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { useXsrStore } from "@/stores/xsrStore";
import { Part, Project, TaskStatus, AssemblyInstance, Assembly } from "@/types/types";
import { db } from "@/api/firebase";
import { doc, getDoc, updateDoc, writeBatch } from "firebase/firestore";
import { useParams } from "next/navigation";
import { QRCodeSVG } from 'qrcode.react';
import { useReactToPrint } from 'react-to-print';

// QR kod bileşeni
const QRCodeComponent = ({ value }: { value: string }) => {
  return <QRCodeSVG value={value} size={128} />;
};

// QR kod yazdırma bileşeni
const QRCodePrintSheet = ({ qrCodes, type }: { qrCodes: { id: string; url: string }[], type: 'assembly' | 'part' }) => {
  return (
    <div className="print-container">
      <style>
        {`
          @media print {
            @page {
              size: A4 landscape;
              margin: 0;
            }
            .print-container {
              width: 297mm;
              height: 210mm;
              padding: 0;
              margin: 0;
              background: white;
              box-sizing: border-box;
            }
            .qr-page {
              width: 297mm;
              height: 210mm;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              page-break-after: always;
            }
            .qr-container {
              width: 100%;
              height: 100%;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              border: 1mm solid #eee;
              border-radius: 5mm;
              box-sizing: border-box;
            }
            .qr-title {
              font-size: 20mm;
              font-weight: bold;
              text-align: center;
              max-width: 100%;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
            .qr-code {
              width: 100%;
              height: 100%;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .qr-code svg {
              width: 150mm;
              height: 150mm;
            }
          }
        `}
      </style>
      {qrCodes.map((qr, index) => (
        <div key={`${qr.id}-${index}-${Date.now()}`} className="qr-page">
          <div className="qr-container">
            <div className="qr-title">{qr.id}</div>
            <div className="qr-code">
              <QRCodeSVG value={qr.url} size={320} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default function ProjectDetailPage() {
  const { id } = useParams();
  const projectId = Array.isArray(id) ? id[0] : id;
  const { viewingProject, setViewingProject } = useXsrStore();
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [selectedParts, setSelectedParts] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);
  const [printData, setPrintData] = useState<{ qrCodes: { id: string; url: string }[], type: 'assembly' | 'part' } | null>(null);
  const [printUniqueOnly, setPrintUniqueOnly] = useState(true);
  
  // Filtreleme state'leri
  const [filters, setFilters] = useState({
    partName: '',
    profile: '',
    quantity: '',
    length: '',
    taskName: ''
  });

  // Yazdırma fonksiyonu
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    pageStyle: `
      @page {
        size: A4;
        margin: 0;
      }
      @media print {
        body {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
      }
    `,
  });

  // Proje verisini yükle
  useEffect(() => {
    const fetchProject = async () => {
      if (!projectId) return;
      
      try {
        setLoading(true);
        const docRef = doc(db, "projects", projectId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();

          // Default tasks tanımla
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

          // Parts'ları işle ve assembly instances'ları oluştur
          const processedParts = (data.parts || []).map((part: Part) => {
            const assemblyInstances: Record<string, AssemblyInstance[]> = {};
            
            // Her assembly için instance'ları oluştur
            Object.entries(data.assemblies || {}).forEach(([assemblyId, assemblyData]) => {
              const assembly = assemblyData as Assembly;
              if (assembly.parts.some((p: Part) => p.part === part.part)) {
                // Eğer part'ın mevcut assemblyInstances'ı varsa onu kullan, yoksa yeni oluştur
                const existingInstances = part.assemblyInstances?.[assemblyId];
                assemblyInstances[assemblyId] = existingInstances || Array.from(
                  { length: parseInt(assembly.qty) },
                  (_, index) => ({
                    id: index + 1,
                    assemblyId: assemblyId,
                    status: "pending",
                    tasks: {}
                  })
                );
              }
            });

            return {
              ...part,
              assemblyInstances: {
                ...part.assemblyInstances,
                ...assemblyInstances
              }
            };
          });

          const project: Project = {
            id: data.id,
            projectName: data.projectName,
            total_kg: data.total_kg,
            projectStatus: data.projectStatus,
            createdAt: data.createdAt,
            assemblies: data.assemblies || {},
            parts: processedParts,
            bolts: data.bolts || [],
            washers: data.washers || [],
            nuts: data.nuts || []
          };
          setViewingProject(project);
        }
      } catch (error) {
        console.error("Proje yüklenirken hata:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProject();
  }, [projectId]);

  // Tüm benzersiz parçaları topla
  const allParts: Part[] = useMemo(() => {
    if (!viewingProject?.parts) return [];

    const seen = new Set<string>();
    const uniqueParts: Part[] = [];

    viewingProject.parts.forEach((part) => {
      if (!seen.has(part.part)) {
        seen.add(part.part);
        uniqueParts.push(part);
      }
    });

    return uniqueParts;
  }, [viewingProject]);

  // Filtreleme fonksiyonu
  const filteredParts = useMemo(() => {
    if (!allParts) return [];
    
    return allParts.filter(part => {
      const matchesPartName = part.part.toLowerCase().includes(filters.partName.toLowerCase());
      const matchesProfile = part.profile.toLowerCase().includes(filters.profile.toLowerCase());
      const matchesQuantity = filters.quantity === '' || part.qty.toString().includes(filters.quantity);
      const matchesLength = filters.length === '' || part.length_mm.toString().includes(filters.length);
      
      // Görev adı filtrelemesi
      const matchesTaskName = filters.taskName === '' || 
        Object.values(part.assemblyInstances || {}).some(instances =>
          instances.some(instance =>
            Object.entries(instance.tasks || {})
              .some(([taskName, status]) => 
                (status as TaskStatus).set && 
                taskName.toLowerCase().includes(filters.taskName.toLowerCase())
              )
          )
        );
      
      return matchesPartName && matchesProfile && matchesQuantity && matchesLength && matchesTaskName;
    });
  }, [allParts, filters]);

  // Filtre değişikliği handler'ı
  const handleFilterChange = (key: keyof typeof filters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Görev key'lerini belirle
  const taskKeys = useMemo(() => {
    
    if (!allParts.length) {
      return [];
    }
    
    const allTasks = new Set<string>();
    
    allParts.forEach((part) => {
      // Her assembly için instance'ları kontrol et
      Object.values(part.assemblyInstances || {}).forEach(instances => {
        if (!instances) return;
        
        instances.forEach(instance => {
          if (!instance?.tasks) return;
          
          Object.keys(instance.tasks).forEach(task => {
            allTasks.add(task);
          });
        });
      });
    });

    const tasks = Array.from(allTasks);
    return tasks;
  }, [allParts]);

  const toggleTask = (task: string) => {
    setSelectedTasks((prev) =>
      prev.includes(task) ? prev.filter((t) => t !== task) : [...prev, task]
    );
  };

  const togglePart = (partId: string) => {
    setSelectedParts((prev) => {
      const newSet = new Set(prev);
      newSet.has(partId) ? newSet.delete(partId) : newSet.add(partId);
      return newSet;
    });
  };

  const handleAssign = async () => {
    if (!viewingProject?.id || !projectId) return;
    try {
      const projectRef = doc(db, "projects", projectId);
      const updatedParts = (viewingProject.parts || []).map((part) => {
        if (selectedParts.has(part.part)) {
          // Her assembly için instance'ları oluştur
          const assemblyInstances: Record<string, AssemblyInstance[]> = {};
          
          // Parçanın bulunduğu tüm assembly'leri bul
          Object.entries(viewingProject.assemblies || {}).forEach(([assemblyId, assembly]) => {
            if (assembly.parts.some(p => p.part === part.part)) {
              // Assembly miktarı kadar instance oluştur
              assemblyInstances[assemblyId] = Array.from(
                { length: parseInt(assembly.qty) },
                (_, index) => ({
                  id: index + 1,
                  assemblyId: assemblyId,
                  status: "pending",
                  tasks: Object.fromEntries(
                    selectedTasks.map(task => [
                      task,
                      { set: true, isDone: false }
                    ])
                  )
                })
              );
            }
          });

          return {
            ...part,
            assemblyInstances
          };
        }
        return part;
      });

      // Projeyi güncelle
      await updateDoc(projectRef, {
        parts: updatedParts
      });

      // Store'u güncelle
      const updatedProject = {
        ...viewingProject,
        parts: updatedParts
      };
      setViewingProject(updatedProject);

      // Seçimleri sıfırla
      setSelectedParts(new Set());
      setSelectedTasks([]);

      alert("Görev atamaları başarı ile yapıldı.");
    } catch (error) {
      console.error("Error assigning tasks:", error);
      alert("Görev atamaları yapılırken bir hata oluştu.");
    }
  };

  const handleUnassign = async () => {
    if (!viewingProject?.id || !projectId) return;
    try {
      const projectRef = doc(db, "projects", projectId);
      const updatedParts = (viewingProject.parts || []).map((part) => {
        if (selectedParts.has(part.part)) {
          // Her assembly için instance'ları güncelle
          const updatedAssemblyInstances: Record<string, AssemblyInstance[]> = {};
          Object.entries(part.assemblyInstances || {}).forEach(([assemblyId, instances]) => {
            updatedAssemblyInstances[assemblyId] = instances.map(instance => {
              // Seçili görevleri set:false yap
              const updatedTasks = { ...instance.tasks };
              selectedTasks.forEach(task => {
                if (updatedTasks[task]) {
                  updatedTasks[task] = { ...updatedTasks[task], set: false };
                }
              });
              return {
                ...instance,
                tasks: updatedTasks
              };
            });
          });
          return {
            ...part,
            assemblyInstances: updatedAssemblyInstances
          };
        }
        return part;
      });
      await updateDoc(projectRef, {
        parts: updatedParts
      });
      // Store'u güncelle
      setViewingProject({
        ...viewingProject,
        parts: updatedParts,
      });
      setSelectedParts(new Set());
      setSelectedTasks([]);
      alert("Seçili görevler başarıyla iptal edildi.");
    } catch (error) {
      console.error("Error unassigning tasks:", error);
      alert("Görev iptal edilirken bir hata oluştu.");
    }
  };

  // Görev istatistiklerini hesapla
  const taskStats = useMemo(() => {
    if (!viewingProject?.parts) return { total: 0, completed: 0 };

    let totalTasks = 0;
    let completedTasks = 0;

    viewingProject.parts.forEach(part => {
      // Her assembly için instance'ları kontrol et
      Object.values(part.assemblyInstances || {}).forEach(instances => {
        if (!instances) return;
        
        instances.forEach(instance => {
          if (!instance?.tasks) return;
          
          Object.values(instance.tasks).forEach(task => {
            if ((task as TaskStatus).set) {
              totalTasks++;
              if ((task as TaskStatus).isDone) {
                completedTasks++;
              }
            }
          });
        });
      });
    });

    return {
      total: totalTasks,
      completed: completedTasks,
      percentage: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0
    };
  }, [viewingProject]);

  // Görev durumlarını güncelle
  const updateTaskStatus = async (
    partId: string,
    taskName: string,
    status: TaskStatus
  ) => {
    if (!viewingProject) return;

    try {
      const projectRef = doc(db, "projects", viewingProject.id);
      const updatedParts = (viewingProject.parts || []).map((part) => {
        if (part.part === partId) {
          // Update tasks in all assembly instances
          const updatedAssemblyInstances = { ...part.assemblyInstances };
          Object.keys(updatedAssemblyInstances).forEach(assemblyId => {
            updatedAssemblyInstances[assemblyId] = updatedAssemblyInstances[assemblyId].map(instance => ({
              ...instance,
              tasks: {
                ...instance.tasks,
                [taskName]: status
              }
            }));
          });

          return {
            ...part,
            assemblyInstances: updatedAssemblyInstances
          };
        }
        return part;
      });

      await updateDoc(projectRef, {
        parts: updatedParts,
      });

      // Store'u güncelle
      setViewingProject({
        ...viewingProject,
        parts: updatedParts,
      });
    } catch (error) {
      console.error("Error updating task status:", error);
    }
  };

  // QR kod yazdırma fonksiyonu
  const handlePrintQRCodes = (type: 'assembly' | 'part') => {
    if (!viewingProject) return;

    let qrCodes: { id: string; url: string }[] = [];
    if (type === 'assembly') {
      Object.entries(viewingProject.assemblies || {}).forEach(([assemblyId, assembly]) => {
        const qty = typeof assembly.qty === 'number' ? assembly.qty : 1;
        for (let i = 0; i < qty; i++) {
          qrCodes.push({
            id: `${assemblyId}-${i + 1}`,
            url: `${window.location.origin}/projects/${projectId}/assemblyDetail/${assemblyId.replace(/\//g, '-')}`
          });
        }
      });
    } else {
      (viewingProject.parts || []).forEach(part => {
        qrCodes.push({
          id: part.part,
          url: `${window.location.origin}/projects/${projectId}/partDetail/${part.part}`
        });
      });
    }

    setPrintData({ qrCodes, type });
    setTimeout(() => {
      handlePrint();
      setPrintData(null);
    }, 100);
  };

  if (loading) {
    return <p className="p-4">Proje yükleniyor...</p>;
  }

  if (!viewingProject) {
    return <p className="p-4 text-red-500">Proje bulunamadı.</p>;
  }

  if (allParts.length === 0) {
    return <p className="p-4">Bu projede hiç parça bulunamadı.</p>;
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6">
      <h2 className="text-xl sm:text-2xl font-bold mb-4">
        {viewingProject.projectName} - Görev Atama
      </h2>

      <div className="mb-4 bg-white p-4 sm:p-6 rounded-xl shadow-lg">
        <p className="font-semibold mb-4 text-gray-800">Görevler:</p>
        <div className="flex flex-wrap gap-2 sm:gap-4">
          {taskKeys.map((task) => (
            <label key={task} className="flex items-center gap-2 bg-gray-50 px-3 sm:px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors duration-200 text-sm sm:text-base">
              <input
                type="checkbox"
                checked={selectedTasks.includes(task)}
                onChange={() => toggleTask(task)}
                className="w-4 h-4 sm:w-5 sm:h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <span className="text-gray-700">{task}</span>
            </label>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-6">
          <button
            onClick={handleAssign}
            disabled={selectedParts.size === 0 || selectedTasks.length === 0}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-4 sm:px-6 py-2.5 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Seçili Görevleri Ata
          </button>
          <button
            onClick={handleUnassign}
            disabled={selectedParts.size === 0 || selectedTasks.length === 0}
            className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white px-4 sm:px-6 py-2.5 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Seçili Görevleri İptal Et
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Parça Adı</label>
              <input
                type="text"
                value={filters.partName}
                onChange={(e) => handleFilterChange('partName', e.target.value)}
                placeholder="Parça adına göre filtrele..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Profil</label>
              <input
                type="text"
                value={filters.profile}
                onChange={(e) => handleFilterChange('profile', e.target.value)}
                placeholder="Profile göre filtrele..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Adet</label>
              <input
                type="text"
                value={filters.quantity}
                onChange={(e) => handleFilterChange('quantity', e.target.value)}
                placeholder="Adete göre filtrele..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Uzunluk (mm)</label>
              <input
                type="text"
                value={filters.length}
                onChange={(e) => handleFilterChange('length', e.target.value)}
                placeholder="Uzunluğa göre filtrele..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Görev Adı</label>
              <input
                type="text"
                value={filters.taskName}
                onChange={(e) => handleFilterChange('taskName', e.target.value)}
                placeholder="Görev adına göre filtrele..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead>
              <tr className="bg-gray-50">
                <th className="py-3 px-3 sm:px-4 font-semibold text-gray-700 text-sm sm:text-base">Seç</th>
                <th className="py-3 px-3 sm:px-4 font-semibold text-gray-700 text-sm sm:text-base">Parça</th>
                <th className="py-3 px-3 sm:px-4 font-semibold text-gray-700 text-sm sm:text-base">Profil</th>
                <th className="py-3 px-3 sm:px-4 font-semibold text-gray-700 text-sm sm:text-base">Kalite</th>
                <th className="py-3 px-3 sm:px-4 font-semibold text-gray-700 text-sm sm:text-base">Uzunluk (mm)</th>
                <th className="py-3 px-3 sm:px-4 font-semibold text-gray-700 text-sm sm:text-base">Adet</th>
                <th className="py-3 px-3 sm:px-4 font-semibold text-gray-700 text-sm sm:text-base">Ağırlık (kg)</th>
                <th className="py-3 px-3 sm:px-4 font-semibold text-gray-700 text-sm sm:text-base">Mevcut Görevler</th>
              </tr>
            </thead>
            <tbody>
              {filteredParts.map((part) => (
                <tr 
                  key={part.part} 
                  className="hover:bg-gray-50 transition-colors duration-200 cursor-pointer border-b border-gray-100"
                  onClick={() => togglePart(part.part)}
                >
                  <td className="py-3 px-3 sm:px-4" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedParts.has(part.part)}
                      onChange={() => togglePart(part.part)}
                      className="w-4 h-4 sm:w-5 sm:h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </td>
                  <td className="py-3 px-3 sm:px-4 font-medium text-gray-900 text-sm sm:text-base">{part.part}</td>
                  <td className="py-3 px-3 sm:px-4 text-gray-700 text-sm sm:text-base">{part.profile}</td>
                  <td className="py-3 px-3 sm:px-4 text-gray-700 text-sm sm:text-base">{part.grade}</td>
                  <td className="py-3 px-3 sm:px-4 text-gray-700 text-sm sm:text-base">{part.length_mm}</td>
                  <td className="py-3 px-3 sm:px-4 text-gray-700 text-sm sm:text-base">{part.qty}</td>
                  <td className="py-3 px-3 sm:px-4 text-gray-700 text-sm sm:text-base">{part.weight_kg}</td>
                  <td className="py-3 px-3 sm:px-4">
                    <div className="flex flex-wrap gap-1 sm:gap-2">
                      {Array.from(new Set(Object.values(part.assemblyInstances || {}).flatMap(instances => 
                        instances?.flatMap(instance => 
                          Object.entries(instance?.tasks || {})
                            .filter(([_, status]) => (status as TaskStatus).set)
                            .map(([task]) => task)
                        ) || []
                      ))).map(task => (
                        <span key={task} className="px-2 py-0.5 sm:px-2.5 sm:py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full whitespace-nowrap">
                          {task}
                        </span>
                      )) || <span className="text-gray-500 text-xs sm:text-sm">Yok</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Yazdırma içeriği */}
      <div style={{ display: 'none' }}>
        {printData && (
          <div ref={printRef}>
            <QRCodePrintSheet qrCodes={printData.qrCodes} type={printData.type} />
          </div>
        )}
      </div>

      {/* QR Kod Yazdırma Butonları */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">QR Kod Yazdırma</h2>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="uniqueOnly"
              checked={printUniqueOnly}
              onChange={(e) => setPrintUniqueOnly(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="uniqueOnly" className="text-sm text-gray-700">
              Sadece benzersiz parçalar için QR kod yazdır
            </label>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => handlePrintQRCodes('assembly')}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Tüm Birleşimler İçin QR Yazdır
            </button>
            <button
              onClick={() => handlePrintQRCodes('part')}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              {printUniqueOnly ? 'Benzersiz Parçalar İçin QR Yazdır' : 'Tüm Parçalar İçin QR Yazdır'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
