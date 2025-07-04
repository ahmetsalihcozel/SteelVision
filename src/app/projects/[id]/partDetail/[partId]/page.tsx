"use client";
import { useXsrStore } from "@/stores/xsrStore";
import { useParams, useRouter } from "next/navigation";
import React, { useEffect, useState, useMemo, useRef } from "react";
import { getDownloadURL, ref } from "firebase/storage";
import { storage, getSiteUrl, getProject } from "@/api/firebase";
import Link from "next/link";
import { QRCodeSVG } from 'qrcode.react';
import { doc, onSnapshot, updateDoc, getDoc } from "firebase/firestore";
import { db } from "@/api/firebase";
import { useAuth } from "@/context/AuthContex";
import { Project, Part, TaskStatus } from "@/types/types";

export default function PartDetailPage() {
  const { id, partId } = useParams();
  const projectId = Array.isArray(id) ? id[0] : id;
  const partIdStr = Array.isArray(partId) ? partId[0] : partId;
  const router = useRouter();
  const { viewingProject, setViewingProject } = useXsrStore();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [project, setProject] = useState<Project | null>(null);
  const { userData } = useAuth();
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const qrRef = useRef<HTMLDivElement>(null);
  const [siteUrl, setSiteUrl] = useState("http://localhost:3000");
  const [isAdmin, setIsAdmin] = useState(false);
  const [editingTask, setEditingTask] = useState<{ task: string; partId: string } | null>(null);
  const [doneBy, setDoneBy] = useState("");
  const [doneAt, setDoneAt] = useState("");
  const [isPdfFullscreen, setIsPdfFullscreen] = useState(false);

  const part = React.useMemo(() => {
    if (!viewingProject?.assemblies || !partIdStr) return null;
    for (const assembly of Object.values(viewingProject.assemblies)) {
      const found = assembly.parts.find((p) => p.part === partIdStr);
      if (found) return found;
    }
    return null;

  }, [viewingProject, partIdStr]);

  const assembliesWithPart = React.useMemo(() => {
    if (!viewingProject?.assemblies || !partIdStr) return [];

    return Object.entries(viewingProject.assemblies)
      .filter(([_, assembly]) => 
        assembly.parts.some(p => p.part === partIdStr)
      )
      .map(([assemblyName, assembly]) => {
        const partInAssembly = assembly.parts.find(p => p.part === partIdStr);
        const totalQty = parseInt(partInAssembly?.qty || "0") * parseInt(assembly.qty || "0");
        return {
          name: assemblyName,
          qty: totalQty.toString(),
          assemblyQty: assembly.qty
        };
      });
  }, [viewingProject, partIdStr]);

  const totalQuantity = useMemo(() => {
    return assembliesWithPart.reduce((total, assembly) => total + parseInt(assembly.qty), 0);
  }, [assembliesWithPart]);

  useEffect(() => {
    const fetchProjectData = async () => {
      if (!projectId) return;

      try {
        if (!viewingProject) {
          const projectData = await getProject(projectId);
          if (projectData) {
            setProject(projectData);
            setViewingProject(projectData);
            setIsAdmin(userData?.isAdmin || false);
          } else {
            setError("Proje bulunamadı.");
          }
        } else {
          setProject(viewingProject);
          setIsAdmin(userData?.isAdmin || false);
        }
      } catch (error) {
        console.error("Error fetching project:", error);
        setError("Proje yüklenirken bir hata oluştu.");
      } finally {
        setLoading(false);
      }
    };

    fetchProjectData();

    if (!projectId) return;
    const projectRef = doc(db, "projects", projectId);
    const unsubscribe = onSnapshot(projectRef, (doc) => {
      if (doc.exists()) {
        const projectData = doc.data() as Project;
        setProject(projectData);
        setViewingProject(projectData);
      }
    }, (error) => {
      console.error("Error listening to project updates:", error);
    });

    return () => unsubscribe();
  }, [projectId, viewingProject, setViewingProject, userData]);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;
      
      try {
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const data = userDocSnap.data();
        }
      } catch (error) {
        console.error("Kullanıcı verileri yüklenirken hata:", error);
      }
    };

    fetchUserData();
  }, [user]);

  useEffect(() => {
    if (!viewingProject?.id || !partIdStr) return;

    // Dosya adını temizleme fonksiyonu
    const cleanFileName = (fileName: string) => {
      // PDF uzantısını geçici olarak kaldır
      const nameWithoutExt = fileName.replace(/\.pdf$/i, '');
      
      // "-" karakterinden sonra gelen tüm metni kaldır (STANDARD, BRACE, vb.)
      const cleanedName = nameWithoutExt.replace(/\s*-\s*[^-]*$/, '');
      
      // PDF uzantısını geri ekle
      return cleanedName + '.pdf';
    };

    const cleanedName = cleanFileName(partIdStr + '.pdf')
      .replace(/\.pdf$/i, '') // PDF uzantısını kaldır
      .replace(/\s+/g, "")
      .replace(/\//g, "");

    const path = `projects/${viewingProject.id}/Parcalar/${cleanedName}.pdf`;
    console.log(`🔍 Parça PDF aranıyor: ${path}`);
    
    const fileRef = ref(storage, path);

    getDownloadURL(fileRef)
      .then((url) => {
        setPdfUrl(url);
      })
      .catch((error) => {
        setPdfUrl(null);
      });
  }, [partIdStr, viewingProject?.id]);

  useEffect(()=>{
    console.log(viewingProject)

  },[])
  useEffect(() => {
    const loadSiteUrl = async () => {
      try {
        const url = await getSiteUrl();
        setSiteUrl(url);
      } catch (error) {
        console.error("Error loading site URL:", error);
      }
    };
    loadSiteUrl();
  }, []);

  const qrCodeUrl = `${siteUrl}/projects/${viewingProject?.id}/partDetail/${partId}`;

  const handlePrint = () => {
    if (!qrRef.current) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>${partId} - QR Kod</title>
          <style>
            @page {
              size: A4;
              margin: 0;
            }
            body { 
              font-family: Arial, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              background: white;
            }
            .qr-container {
              text-align: center;
              padding: 20mm;
              width: 210mm;
              height: 297mm;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
            }
            .part-name {
              font-size: 24pt;
              font-weight: bold;
              margin-bottom: 10mm;
            }
            .qr-code {
              width: 170mm;
              height: 170mm;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .qr-code svg {
              width: 100%;
              height: 100%;
            }
            .instructions {
              margin-top: 10mm;
              font-size: 12pt;
              color: #666;
            }
          </style>
        </head>
        <body>
          <div class="qr-container">
            <div class="part-name">${partId}</div>
            <div class="qr-code">
              ${qrRef.current.innerHTML}
            </div>
            <div class="instructions">
              Bu QR kodu tarayarak parça detaylarına erişebilirsiniz.
            </div>
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.print();
  };

  const assemblyInstances = useMemo(() => {
    if (!part || !project || !viewingProject) {
      console.log("❌ Part, project or viewingProject is missing:", { part, project, viewingProject });
      return [];
    }

    console.log("🔍 ViewingProject data:", viewingProject);
    const currentPart = viewingProject.parts.find(p => p.part === partIdStr);
    console.log("🔍 Current part in viewingProject:", currentPart);

    const assembliesWithPart = Object.entries(viewingProject.assemblies)
      .filter(([_, assembly]) => assembly.parts.some(p => p.part === partIdStr))
      .map(([assemblyName, assembly]) => {
        const currentInstances = currentPart?.assemblyInstances?.[assemblyName] || [];
        const assemblyQty = parseInt(assembly.qty || "0");
        
        console.log(`📦 Processing assembly ${assemblyName}:`, {
          assembly,
          currentInstances,
          assemblyQty
        });

        const instances = Array.from({ length: assemblyQty }, (_, index) => {
          const instanceId = index + 1;
          const currentInstance = currentInstances.find(i => i.id === instanceId);
          
          console.log(`🔧 Instance ${instanceId} data:`, {
            currentInstance,
            assemblyName
          });

          return {
            id: instanceId,
            tasks: currentInstance?.tasks || {}
          };
        });

        return {
          assemblyName,
          instances
        };
      });

    console.log("✅ Final assembly instances:", assembliesWithPart);
    return assembliesWithPart;
  }, [part, project, viewingProject, partIdStr]);

  const updateTaskStatus = async (
    assemblyName: string,
    instanceId: number,
    taskName: string,
    status: TaskStatus,
    projectId: string,
    partId: number
  ) => {
    if (!project || !user || !userData) return;

    try {
      const projectRef = doc(db, "projects", projectId);
      const updatedParts = project.parts.map((p) => {
        if (p.part === partIdStr) {
          const updatedInstances = p.assemblyInstances?.[assemblyName]?.map(instance => {
            if (instance.id === instanceId) {
              const currentTask = instance.tasks[taskName] as TaskStatus;
              if (currentTask?.doneBy && currentTask.doneBy !== `${userData.firstName} ${userData.lastName}` && !userData.isAdmin) {
                return instance;
              }

              const updatedTask = {
                set: status.set,
                isDone: status.isDone,
                ...(status.isDone ? {
                  doneBy: `${userData.firstName} ${userData.lastName}`,
                  doneAt: new Date().toISOString()
                } : {})
              };

              return {
                ...instance,
                tasks: {
                  ...instance.tasks,
                  [taskName]: updatedTask
                }
              };
            }
            return instance;
          }) || [];

          return {
            ...p,
            assemblyInstances: {
              ...p.assemblyInstances,
              [assemblyName]: updatedInstances
            }
          };
        }
        return p;
      });

      await updateDoc(projectRef, {
        parts: updatedParts,
      });

      setViewingProject({
        ...project,
        parts: updatedParts,
      });
    } catch (error) {
      console.error("Error updating task status:", error);
    }
  };

  const handleEditTask = (task: string, partId: string) => {
    setEditingTask({ task, partId });
    const part = viewingProject?.parts.find(p => p.part === partId);
    if (part) {
      const taskStatus = part.assemblyInstances?.[projectId || ""]?.[0]?.tasks?.[task];
      if (taskStatus) {
        setDoneBy(taskStatus.doneBy || "");
        setDoneAt(taskStatus.doneAt || "");
      }
    }
  };

  const handleSaveEdit = async () => {
    try {
      if (!editingTask || !viewingProject || !partIdStr) {
        console.log("Missing required data:", { editingTask, viewingProject, partIdStr });
        return;
      }

      const { task } = editingTask;
      console.log("Starting task update for:", { task, partIdStr });

      const part = viewingProject.parts.find(p => p.part === partIdStr);
      if (!part) {
        console.log("Part not found:", partIdStr);
        return;
      }

      let foundAssembly = null;
      let foundInstance = null;

      for (const [assemblyName, instances] of Object.entries(part.assemblyInstances || {})) {
        for (const instance of instances) {
          if (instance.tasks && instance.tasks[task]) {
            foundAssembly = assemblyName;
            foundInstance = instance;
            break;
          }
        }
        if (foundAssembly) break;
      }

      if (!foundAssembly || !foundInstance) {
        console.log("No assembly or instance found with task:", task);
        return;
      }

      console.log("Found assembly and instance:", { foundAssembly, foundInstance });

      const currentTask = foundInstance.tasks[task];
      console.log("Current task status:", currentTask);

      const updatedStatus: TaskStatus = {
        ...currentTask,
        set: true,
        isDone: true,
        doneBy,
        doneAt: new Date(doneAt).toISOString()
      };

      console.log("Updating task with status:", updatedStatus);

      const projectRef = doc(db, "projects", projectId || "");
      const updatedParts = viewingProject.parts.map((p) => {
        if (p.part === partIdStr) {
          const updatedInstances = p.assemblyInstances?.[foundAssembly]?.map(instance => {
            if (instance.id === foundInstance.id) {
              return {
                ...instance,
                tasks: {
                  ...instance.tasks,
                  [task]: updatedStatus
                }
              };
            }
            return instance;
          }) || [];

          return {
            ...p,
            assemblyInstances: {
              ...p.assemblyInstances,
              [foundAssembly]: updatedInstances
            }
          };
        }
        return p;
      });

      await updateDoc(projectRef, {
        parts: updatedParts,
      });

      setViewingProject({
        ...viewingProject,
        parts: updatedParts,
      });

      console.log("Task updated successfully");
      setEditingTask(null);
    } catch (error) {
      console.error("Error updating task:", error);
      alert("Görev güncellenirken bir hata oluştu.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-xl font-bold text-red-800 mb-2">Hata</h2>
            <p className="text-red-700">{error}</p>
            <Link href={`/projects/${projectId}`} className="mt-4 inline-block bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700">
              Projeye Dön
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!part) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <h2 className="text-xl font-bold text-yellow-800 mb-2">Parça Bulunamadı</h2>
            <p className="text-yellow-700">İstediğiniz parça bu projede bulunamadı.</p>
            <Link href={`/projects/${projectId}`} className="mt-4 inline-block bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700">
              Projeye Dön
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{viewingProject?.projectName} - {partId}</h1>
          <div className="flex gap-4 mt-4">
            <Link href={`/projects/${viewingProject?.id}`} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
              Projeye Dön
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 mb-5">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">{partId}</h2>
              <p className="text-gray-600">Profil: {part?.profile}</p>
              <p className="text-gray-600">Kalite: {part?.grade}</p>
              <p className="text-gray-600">Uzunluk: {part?.length_mm} mm</p>
              <p className="text-gray-600">Miktar: {part?.qty}</p>
              <p className="text-gray-600">Ağırlık: {part?.weight_kg} kg</p>
            </div>
            <div className="bg-white p-2 rounded">
              <div ref={qrRef}>
                <QRCodeSVG value={qrCodeUrl} size={128} />
              </div>
              <button
                onClick={handlePrint}
                className="mt-2 w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm"
              >
                QR Kodu Yazdır
              </button>
            </div>
          </div>

          {pdfUrl ? (
            <div className={`${isPdfFullscreen ? 'fixed inset-0 z-50 bg-white' : ''}`}>
              {isPdfFullscreen && (
                <div className="fixed top-4 left-4 z-50">
                  <button
                    onClick={() => setIsPdfFullscreen(false)}
                    className="bg-red-500 text-white p-2 rounded-full hover:bg-red-600 shadow-lg"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
              <div className={`${isPdfFullscreen ? 'h-screen' : 'h-[600px]'} relative`}>
                <iframe
                  src={pdfUrl}
                  className={`w-full h-full border ${isPdfFullscreen ? '' : 'mb-6'}`}
                  title="PDF"
                />
                {!isPdfFullscreen && (
                  <button
                    onClick={() => setIsPdfFullscreen(true)}
                    className="md:hidden absolute bottom-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-blue-700"
                  >
                    Tam Ekran
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-yellow-50 border border-yellow-200 rounded p-4 mb-6">
              <p className="text-yellow-700">
                Bu parça için PDF dosyası bulunamadı. Lütfen dosyanın "Parcalar" klasöründe olduğundan emin olun.
              </p>
            </div>
          )}

          {assembliesWithPart.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4 text-gray-800">Bu Parçanın Kullanıldığı Birleşimler</h3>
              <div className="space-y-3">
                {assembliesWithPart.map((assembly) => (
                  <div key={assembly.name} className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b pb-2">
                    <Link
                      href={`/projects/${viewingProject?.id}/assemblyDetail/${assembly.name.replace(/\//g, "-")}`}
                      className="text-blue-600 hover:underline mb-2 sm:mb-0"
                    >
                      {assembly.name}
                    </Link>
                    <div className="text-gray-600 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-600">Parça Adedi:</span>
                        <span className="px-3 py-1 text-sm font-medium bg-blue-50 text-blue-800 rounded-full">
                          {assembly.assemblyQty}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-600">Birleşim Adedi:</span>
                        <span className="px-3 py-1 text-sm font-medium bg-purple-50 text-purple-800 rounded-full">
                          {assembly.assemblyQty}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Assembly ve Instance'lar */}
        <div className="space-y-8">
          {assemblyInstances.map(({ assemblyName, instances }) => {
            console.log(`🎯 Rendering assembly ${assemblyName}:`, instances);
            return (
              <div key={assemblyName} className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex justify-between items-center mb-6">
                  <div className="flex flex-col">
                    <Link 
                      href={`/projects/${viewingProject?.id}/assemblyDetail/${assemblyName.replace(/\//g, "-")}`}
                      className="text-blue-600 hover:underline text-xl font-bold"
                    >
                      {`${assemblyName} `}
                    </Link>
                    <p className="text-md text-gray-800">içinde {partId} görevleri:</p>
                  </div>
                  <span className="text-sm text-gray-600">
                    {instances.length} Örnek
                  </span>
                </div>

                <div className="space-y-6">
                  {instances.map((instance) => {
                    const hasTasks = Object.entries(instance.tasks as Record<string, TaskStatus>)
                      .filter(([_, taskStatus]) => taskStatus.set)
                      .length > 0;

                    console.log(`📝 Instance ${instance.id} tasks:`, {
                      tasks: instance.tasks,
                      hasTasks,
                      filteredTasks: Object.entries(instance.tasks as Record<string, TaskStatus>)
                        .filter(([_, taskStatus]) => taskStatus.set)
                    });

                    return (
                      <div key={`${assemblyName}-${instance.id}`} className="rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition-shadow duration-200">
                        <h3 className="font-semibold mb-2 text-gray-800">Birleşim #{instance.id}</h3>
                        {hasTasks ? (
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            {Object.entries(instance.tasks as Record<string, TaskStatus>)
                              .filter(([_, taskStatus]) => taskStatus.set)
                              .map(([task, taskStatus]) => {
                                const isChecked = taskStatus.isDone;
                                const isDoneByCurrentUser = taskStatus.doneBy === `${userData?.firstName} ${userData?.lastName}`;
                                const isDisabled = isChecked && !isDoneByCurrentUser && !userData?.isAdmin;

                                return (
                                  <div
                                    key={task}
                                    className={`p-2 rounded cursor-pointer ${
                                      isChecked ? "bg-green-100" : "bg-yellow-100"
                                    }`}
                                    onClick={() => {
                                      if (!isDisabled) {
                                        updateTaskStatus(assemblyName, instance.id, task, {
                                          ...taskStatus,
                                          isDone: !isChecked,
                                        }, projectId || "", 0);
                                      }
                                    }}
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="text-sm text-gray-800">{task}</span>
                                      <div className="flex items-center gap-2">
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={(e) =>
                                            updateTaskStatus(assemblyName, instance.id, task, {
                                              ...taskStatus,
                                              isDone: e.target.checked,
                                            }, projectId || "", 0)
                                          }
                                          disabled={isDisabled}
                                          className={`w-4 h-4 ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                                          onClick={(e) => e.stopPropagation()}
                                        />
                                        <span className="text-sm text-gray-800">
                                          {isChecked ? "✓" : "⏳"}
                                        </span>
                                      </div>
                                    </div>
                                    {taskStatus.doneBy && (
                                      <div className="text-xs mt-2 space-y-1">
                                        <div className="inline-flex items-center px-2 py-1 rounded bg-blue-100 text-blue-800">
                                          <span className="font-medium">Görevi Yapan:</span>
                                          <span className="ml-1">{taskStatus.doneBy}</span>
                                        </div>
                                        <div className="inline-flex items-center px-2 py-1 rounded bg-orange-100 text-orange-800">
                                          <span className="font-medium">Tarih:</span>
                                          <span className="ml-1">{new Date(taskStatus.doneAt || '').toLocaleString('tr-TR', {
                                            year: 'numeric',
                                            month: '2-digit',
                                            day: '2-digit',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                          })}</span>
                                        </div>
                                      </div>
                                    )}
                                    {isAdmin && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (partIdStr) {
                                            handleEditTask(task, partIdStr);
                                          }
                                        }}
                                        className="mt-2 text-blue-600 hover:text-blue-800"
                                      >
                                        Düzenle
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                          </div>
                        ) : (
                          <div className="text-center text-gray-500 py-4">
                            Bu örnek için görev bulunmamaktadır.
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {editingTask && (
          <div className="fixed inset-0 bg-black bg-opacity-25 flex items-center justify-center">
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <h3 className="text-lg font-bold mb-4">Görevi Düzenle</h3>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">Görevi Yapan</label>
                <input
                  type="text"
                  value={doneBy}
                  onChange={(e) => setDoneBy(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">Tarih</label>
                <input
                  type="datetime-local"
                  value={doneAt}
                  onChange={(e) => setDoneAt(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setEditingTask(null)}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                >
                  İptal
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Kaydet
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
