// AssemblyDetailPage.tsx
"use client";
import { useXsrStore } from "@/stores/xsrStore";
import { useParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { getDownloadURL, ref } from "firebase/storage";
import { storage, db, getSiteUrl, getProject } from "@/api/firebase";
import { doc, getDoc, updateDoc, onSnapshot } from "firebase/firestore";
import Link from "next/link";
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from "@/context/AuthContex";
import { Part, TaskStatus, Assembly, Project, AssemblyInstance } from "@/types/types";

interface User {
  email: string;
  firstName: string;
  lastName: string;
  isAdmin: boolean;
}

export default function AssemblyDetailPage() {
  const { id, assemblyId } = useParams();
  const projectId = Array.isArray(id) ? id[0] : id;
  const assemblyIdStr = Array.isArray(assemblyId) ? assemblyId[0] : assemblyId;
  const { viewingProject, setViewingProject } = useXsrStore();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const qrRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [assemblyParts, setAssemblyParts] = useState<Part[]>([]);
  const [userData, setUserData] = useState<{ firstName: string; lastName: string; isAdmin: boolean } | null>(null);
  const [siteUrl, setSiteUrl] = useState("http://localhost:3000");
  const [isPdfFullscreen, setIsPdfFullscreen] = useState(false);
  const [project, setProject] = useState<Project | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // URL'deki "-" karakterini "/" ile değiştir
  const originalAssemblyId = assemblyIdStr?.replace(/-/g, "/") || "";

  // Kullanıcı verilerini yükle
  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;
      
      try {
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const data = userDocSnap.data();
          setUserData({
            firstName: data.firstName,
            lastName: data.lastName,
            isAdmin: data.isAdmin
          });
        }
      } catch (error) {
        console.error("Kullanıcı verileri yüklenirken hata:", error);
      }
    };

    fetchUserData();
  }, [user]);

  // Site URL'ini yükle
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

  // Proje verisini yükle
  useEffect(() => {
    const fetchProjectData = async () => {
      if (!projectId) return;

      try {
        // Eğer store'da proje yoksa, fetch et
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

    // Real-time updates için listener
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

  // PDF yükleme işlemi için hata yönetimi
  useEffect(() => {
    if (!viewingProject?.id || !assemblyIdStr) {
      return;
    }

    const loadPdf = async () => {
      try {
        const cleanedName = originalAssemblyId
          .replace(/\s*-\s*/g, "") // Boşluk ve tire işaretlerini kaldır
          .replace(/\s+/g, "") // Tüm boşlukları kaldır
          .replace(/\//g, "") // "/" karakterini kaldır
          .replace(/_/g, ""); // "_" karakterini kaldır

        const path = `projects/${viewingProject.id}/Birlesimler/${cleanedName}.pdf`;        
        const fileRef = ref(storage, path);
        const url = await getDownloadURL(fileRef);
        setPdfUrl(url);
      } catch (error) {
        console.error("❌ Error loading PDF:", error);
        setPdfUrl(null);
      }
    };

    loadPdf();
  }, [assemblyIdStr, viewingProject?.id, originalAssemblyId]);

  // QR kod URL'sini oluştur
  const qrCodeUrl = `${siteUrl}/projects/${projectId}/assemblyDetail/${assemblyIdStr}`;

  // Assembly verilerini al
  const assembly = viewingProject?.assemblies[originalAssemblyId] as Assembly | undefined;
  
  // Assembly parçalarını projedeki parçalarla eşleştir
  const parts = assembly?.parts.map(assemblyPart => {
    const projectPart = viewingProject?.parts.find(p => p.part === assemblyPart.part);
    return {
      ...assemblyPart,
      assemblyInstances: {
        [originalAssemblyId]: projectPart?.assemblyInstances?.[originalAssemblyId] || [{
          id: 1,
          tasks: Object.fromEntries(
            Object.entries(assemblyPart.defaultTasks ?? {}).map(([taskName, task]) => [
              taskName,
              { set: true, isDone: false }
            ])
          )
        }]
      }
    };
  }) || [];

  const updateTaskStatus = async (part: Part, taskName: string, status: TaskStatus, instanceId: number) => {
    if (!viewingProject || !user || !userData) return;

    try {
      const projectRef = doc(db, "projects", viewingProject.id);
      const updatedParts = viewingProject.parts.map((p) => {
        if (p.part === part.part) {
          // Assembly instances'ı güncelle
          const updatedInstances = p.assemblyInstances?.[originalAssemblyId]?.map(instance => {
            if (instance.id === instanceId) {
              const currentTask = instance.tasks[taskName] as TaskStatus;
              // Eğer görev başka biri tarafından yapıldıysa ve kullanıcı admin değilse güncellemeye izin verme
              if (currentTask?.doneBy && currentTask.doneBy !== `${userData.firstName} ${userData.lastName}` && !userData.isAdmin) {
                return instance;
              }

              const updatedTask = {
                set: status.set,
                isDone: status.isDone,
                ...(status.isDone ? {
                  doneBy: `${userData.firstName} ${userData.lastName}`,
                  doneAt: new Date().toISOString()
                } : {
                  doneBy: undefined,
                  doneAt: undefined
                })
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
              [originalAssemblyId]: updatedInstances
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
    } catch (error) {
      console.error("Error updating task status:", error);
    }
  };

  const handlePrint = () => {
    if (!qrRef.current) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>${assemblyIdStr} - QR Kod</title>
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
            .assembly-name {
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
            <div class="assembly-name">${assemblyIdStr}</div>
            <div class="qr-code">
              ${qrRef.current.innerHTML}
            </div>
            <div class="instructions">
              Bu QR kodu tarayarak assembly detaylarına erişebilirsiniz.
            </div>
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.print();
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

  if (!viewingProject) {
    return <div className="p-4 text-red-500">Proje bulunamadı.</div>;
  }

  if (!assembly) {
    return <div className="p-4 text-red-500">Birleşim bulunamadı.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{viewingProject.projectName} - {assemblyIdStr}</h1>
          <div className="flex gap-4 mt-4">
            <Link href={`/projects/${projectId}`} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
              Projeye Dön
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">{assemblyIdStr}</h2>
              <p className="text-gray-600">Miktar: {assembly?.qty}</p>
              <p className="text-gray-600">Ağırlık: {assembly?.weight_kg} kg</p>
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

          <div className="mt-8">
            <h2 className="text-xl font-semibold mb-4">Birleşimler</h2>
            <div className="space-y-8">
              {parts.map((part) => (
                <div key={`${part.part}-${originalAssemblyId}`} 
                     className="rounded-lg p-6 bg-white shadow-sm hover:shadow-md transition-shadow duration-200">
                  <div className="flex justify-between items-start mb-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-lg text-gray-900">{part.part}</h3>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                          Profil: {part.profile}
                        </span>
                        <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                          Malzeme: {part.grade}
                        </span>
                        <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                          Uzunluk: {part.length_mm}mm
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3">
                    <h4 className="font-medium mb-2">Görevler:</h4>
                    <div className="grid grid-cols-1 gap-4">
                      {part.assemblyInstances?.[originalAssemblyId]?.map((instance) => {
                        const hasTasks = Object.entries(instance.tasks as Record<string, TaskStatus>)
                          .filter(([_, taskStatus]) => taskStatus.set)
                          .length > 0;

                        return (
                          <div key={`${part.part}-${instance.id}-${originalAssemblyId}`} 
                               className="rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition-shadow duration-200">
                            {hasTasks && <h5 className="font-medium mb-2">Birleşim #{instance.id}</h5>}
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                              {hasTasks ? (
                                Object.entries(instance.tasks as Record<string, TaskStatus>)
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
                                            updateTaskStatus(part, task, {
                                              ...taskStatus,
                                              isDone: !isChecked,
                                            }, instance.id);
                                          }
                                        }}
                                      >
                                        <div className="flex items-center justify-between">
                                          <span className="text-sm">{task}</span>
                                          <div className="flex items-center gap-2">
                                            <input
                                              type="checkbox"
                                              checked={isChecked}
                                              onChange={(e) =>
                                                updateTaskStatus(part, task, {
                                                  ...taskStatus,
                                                  isDone: e.target.checked,
                                                }, instance.id)
                                              }
                                              disabled={isDisabled}
                                              className={`w-4 h-4 ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                                              onClick={(e) => e.stopPropagation()}
                                            />
                                            <span className="text-sm">
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
                                      </div>
                                    );
                                  })
                              ) : (
                                <div className="col-span-full text-center text-gray-500 py-4">
                                  Bu parça için görev bulunmamaktadır.
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {pdfUrl ? (
          <div className={`mt-8 ${isPdfFullscreen ? 'fixed inset-0 z-50 bg-white' : ''}`}>
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
                className={`w-full h-full border rounded-lg ${isPdfFullscreen ? '' : 'mb-6'}`}
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
          <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded p-4">
            <p className="text-yellow-700">
              Bu birleşim için PDF dosyası bulunamadı. Lütfen dosyanın "Birlesimler" klasöründe olduğundan emin olun.
            </p>
          </div>
        )}

        <div className="mt-8 bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Parça Listesi</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Parça</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Profil</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kalite</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Uzunluk (mm)</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Adet</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ağırlık (kg)</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {parts.map((part, index) => (
                  <tr key={`${part.part}-${originalAssemblyId}-table-${index}`} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      <Link
                        href={`/projects/${projectId}/partDetail/${part.part}`}
                        className="text-blue-600 hover:underline"
                      >
                        {part.part}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{part.profile}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{part.grade}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{part.length_mm}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{part.qty}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{part.weight_kg}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}