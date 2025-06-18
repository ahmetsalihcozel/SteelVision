"use client";

import { useMemo, useState, useEffect } from "react";
import { useXsrStore } from "@/stores/xsrStore";
import { Part, Project, TaskStatus, AssemblyInstance, Note } from "@/types/types";
import { db } from "@/api/firebase";
import { doc, getDoc, updateDoc, onSnapshot, collection, getDocs } from "firebase/firestore";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "../../../context/AuthContex";
import Link from "next/link";
import { getProject } from "@/api/firebase";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import UserStatsChart from '@/components/UserStatsChart';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const statusBgColor: Record<NonNullable<Project["projectStatus"]>, string> = {
  "beklemede": "bg-yellow-300",
  "devam ediyor": "bg-green-300",
  "bitti": "bg-red-300",
};

export default function ProjectDetailsPage() {
  const { id } = useParams();
  const projectId = Array.isArray(id) ? id[0] : id;
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const { viewingProject, setViewingProject } = useXsrStore();
  const { user } = useAuth();
  const router = useRouter();
  const [error, setError] = useState("");
  const [userData, setUserData] = useState<{ firstName: string; lastName: string; isAdmin: boolean } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [selectedPart, setSelectedPart] = useState<{partId: string, assemblyId: string, instanceId: number} | null>(null);
  const [noteText, setNoteText] = useState("");
  const [editingNote, setEditingNote] = useState<Note | null>(null);

  useEffect(() => {
    const fetchProject = async () => {
      if (!projectId) {
        console.error("❌ Project ID is missing");
        router.push("/projects");
        return;
      }

      try {
        setLoading(true);

        if (viewingProject?.id === projectId) {
          setProject(viewingProject);
          setLoading(false);
          return;
        }

        const projectData = await getProject(projectId);
        if (!projectData) {
          console.error("❌ Project not found:", projectId);
          router.push("/projects");
          return;
        }

        setProject(projectData);
        setViewingProject(projectData);
      } catch (error) {
        console.error("❌ Error fetching project:", error);
        router.push("/projects");
      } finally {
        setLoading(false);
      }
    };

    fetchProject();
  }, [projectId, viewingProject, setViewingProject, router]);

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

  const updateProjectData = async (updates: Partial<Project>) => {
    if (!project) return;

    try {
      const updatedProject = { ...project, ...updates };
      setProject(updatedProject);
      setViewingProject(updatedProject);
    } catch (error) {
      console.error("❌ Error updating project:", error);
    }
  };

  const allParts: Part[] = useMemo(() => {
    if (!project?.parts) return [];

    const seen = new Set<string>();
    const uniqueParts: Part[] = [];

    project.parts.forEach((part) => {
      if (!seen.has(part.part)) {
        seen.add(part.part);
        uniqueParts.push(part);
      }
    });

    return uniqueParts;
  }, [project]);

  const taskStats = useMemo(() => {
    if (!project?.parts) return { total: 0, completed: 0, taskDetails: {} };

    const taskMap = new Map<string, { set: boolean; isDone: boolean }>();
    const taskDetails: Record<string, { total: number; completed: number }> = {};

    project.parts.forEach(part => {
      const partQuantity = parseInt(part.qty) || 1;
      
      Object.values(part.assemblyInstances || {}).forEach(instances => {
        if (!instances) return;
        
        instances.forEach(instance => {
          if (!instance?.tasks) return;
          
          Object.entries(instance.tasks).forEach(([taskName, status]) => {
            const taskStatus = status as TaskStatus;
            if (taskStatus.set) {
              const key = `${part.part}-${taskName}-${instance.id}`;
              
              if (!taskMap.has(key)) {
                taskMap.set(key, { set: true, isDone: taskStatus.isDone });
                
                if (!taskDetails[taskName]) {
                  taskDetails[taskName] = { total: 0, completed: 0 };
                }
                taskDetails[taskName].total += partQuantity;
                if (taskStatus.isDone) {
                  taskDetails[taskName].completed += partQuantity;
                }
              } else {
                const currentStatus = taskMap.get(key)!;
                if (taskStatus.isDone && !currentStatus.isDone) {
                  taskDetails[taskName].completed += partQuantity;
                  taskMap.set(key, { set: true, isDone: true });
                }
              }
            }
          });
        });
      });
    });

    const totalTasks = Array.from(taskMap.values()).reduce((sum, task) => sum + (task.set ? 1 : 0), 0);
    const completedTasks = Array.from(taskMap.values()).filter(task => task.isDone).length;

    return {
      total: totalTasks,
      completed: completedTasks,
      percentage: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0,
      taskDetails
    };
  }, [project]);

  const calculateUserStats = useMemo(() => {
    if (!project) return [];

    const userStats = new Map<string, number>();

    project.parts.forEach(part => {
      Object.values(part.assemblyInstances || {}).forEach(instances => {
        instances.forEach(instance => {
          Object.entries(instance.tasks || {}).forEach(([_, status]) => {
            const taskStatus = status as TaskStatus;
            if (taskStatus.isDone && taskStatus.doneBy) {
              const currentCount = userStats.get(taskStatus.doneBy) || 0;
              userStats.set(taskStatus.doneBy, currentCount + 1);
            }
          });
        });
      });
    });

    return Array.from(userStats.entries()).sort((a, b) => b[1] - a[1]);
  }, [project]);

  const updateTaskStatus = async (
    partId: string,
    taskName: string,
    assemblyId: string,
    instanceId: number,
    status: TaskStatus
  ) => {
    if (!project || !user || !userData) return;

    try {
      const projectRef = doc(db, "projects", project.id);
      const updatedParts = project.parts.map((part) => {
        if (part.part === partId) {
          const updatedAssemblyInstances = { ...part.assemblyInstances };
          
          if (updatedAssemblyInstances[assemblyId]) {
            updatedAssemblyInstances[assemblyId] = updatedAssemblyInstances[assemblyId].map(instance => {
              if (instance.id === instanceId) {
                const currentTask = instance.tasks[taskName] as TaskStatus;
                
                if (currentTask?.doneBy && 
                    currentTask.doneBy !== `${userData.firstName} ${userData.lastName}` && 
                    !userData.isAdmin) {
                  return instance;
                }

                const updatedTask: TaskStatus = {
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
            });
          }

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

      setViewingProject({
        ...project,
        parts: updatedParts,
      });
    } catch (error) {
      console.error("Error updating task status:", error);
    }
  };


  const recentTasks = useMemo(() => {
    if (!viewingProject?.parts) return [];

    const tasks: {
      partId: string;
      taskName: string;
      assemblyName: string;
      instanceId: number;
      doneBy: string;
      doneAt: string;
      key: string;
    }[] = [];

    viewingProject.parts.forEach((part) => {
      Object.entries(part.assemblyInstances || {}).forEach(([assemblyName, instances]) => {
        instances.forEach((instance) => {
          Object.entries(instance.tasks || {}).forEach(([taskName, taskStatus]) => {
            const status = taskStatus as TaskStatus;
            if (status.isDone && status.doneBy && status.doneAt) {
              const taskKey = `${part.part}-${taskName}-${assemblyName}-${instance.id}`;
              
              if (!tasks.some(t => t.key === taskKey)) {
                tasks.push({
                  partId: part.part,
                  taskName,
                  assemblyName,
                  instanceId: instance.id,
                  doneBy: status.doneBy,
                  doneAt: status.doneAt,
                  key: taskKey
                });
              }
            }
          });
        });
      });
    });

    return tasks.sort((a, b) => new Date(b.doneAt).getTime() - new Date(a.doneAt).getTime());
  }, [viewingProject]);

  useEffect(() => {
    if (!projectId) return;

    const projectRef = doc(db, "projects", projectId);
    
    const unsubscribe = onSnapshot(projectRef, (doc) => {
      if (doc.exists()) {
        const projectData = doc.data() as Project;
        setProject(projectData);
        setViewingProject(projectData);
      } else {
        setError("Proje bulunamadı.");
      }
      setLoading(false);
    }, (error) => {
      console.error("Error listening to project updates:", error);
      setError("Proje güncellenirken bir hata oluştu.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [projectId, setViewingProject]);

  const handleAddNote = async () => {
    if (!project || !user || !userData || !selectedPart || !noteText.trim()) return;

    try {
      const projectRef = doc(db, "projects", project.id);
      const updatedParts = project.parts.map((part) => {
        if (part.part === selectedPart.partId) {
          const updatedAssemblyInstances = { ...part.assemblyInstances };
          
          if (updatedAssemblyInstances[selectedPart.assemblyId]) {
            updatedAssemblyInstances[selectedPart.assemblyId] = updatedAssemblyInstances[selectedPart.assemblyId].map(instance => {
              if (instance.id === selectedPart.instanceId) {
                const newNote: Note = {
                  text: noteText,
                  partId: selectedPart.partId,
                  assemblyId: selectedPart.assemblyId,
                  instanceId: selectedPart.instanceId,
                  addedBy: `${userData.firstName} ${userData.lastName}`,
                  addedAt: new Date().toISOString(),
                  stringValue: noteText
                };

                return {
                  ...instance,
                  notes: [...(instance.notes || []), newNote]
                };
              }
              return instance;
            });
          }

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

      setViewingProject({
        ...project,
        parts: updatedParts,
      });

      setIsNoteModalOpen(false);
      setSelectedPart(null);
      setNoteText("");
      setEditingNote(null);
    } catch (error) {
      console.error("Error adding note:", error);
    }
  };

  const handleDeleteNote = async (noteId: string, partId: string, assemblyId: string, instanceId: number) => {
    if (!project || !user || !userData) return;

    // Admin veya not sahibi değilse silme işlemini engelle
    const part = project.parts.find(p => p.part === partId);
    const instance = part?.assemblyInstances?.[assemblyId]?.find(i => i.id === instanceId);
    const note = instance?.notes?.find(n => n.id === noteId);
    
    if (!userData.isAdmin && note?.addedBy !== `${userData.firstName} ${userData.lastName}`) {
      console.error("Not silme yetkiniz yok");
      return;
    }

    try {
      const projectRef = doc(db, "projects", project.id);
      const updatedParts = project.parts.map((part) => {
        if (part.part === partId) {
          const updatedAssemblyInstances = { ...part.assemblyInstances };
          
          if (updatedAssemblyInstances[assemblyId]) {
            updatedAssemblyInstances[assemblyId] = updatedAssemblyInstances[assemblyId].map(instance => {
              if (instance.id === instanceId) {
                return {
                  ...instance,
                  notes: (instance.notes || []).filter((note: Note) => note.id !== noteId)
                };
              }
              return instance;
            });
          }

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

      setViewingProject({
        ...project,
        parts: updatedParts,
      });
    } catch (error) {
      console.error("Error deleting note:", error);
    }
  };

  const handleUpdateNote = async () => {
    if (!project || !user || !userData || !selectedPart || !editingNote || !noteText.trim()) return;

    // Admin veya not sahibi değilse düzenleme işlemini engelle
    const part = project.parts.find(p => p.part === selectedPart.partId);
    const instance = part?.assemblyInstances?.[selectedPart.assemblyId]?.find(i => i.id === selectedPart.instanceId);
    const note = instance?.notes?.find(n => n.id === editingNote.id);
    
    if (!userData.isAdmin && note?.addedBy !== `${userData.firstName} ${userData.lastName}`) {
      console.error("Not düzenleme yetkiniz yok");
      return;
    }

    try {
      const projectRef = doc(db, "projects", project.id);
      const updatedParts = project.parts.map((part) => {
        if (part.part === selectedPart.partId) {
          const updatedAssemblyInstances = { ...part.assemblyInstances };
          
          if (updatedAssemblyInstances[selectedPart.assemblyId]) {
            updatedAssemblyInstances[selectedPart.assemblyId] = updatedAssemblyInstances[selectedPart.assemblyId].map(instance => {
              if (instance.id === selectedPart.instanceId) {
                return {
                  ...instance,
                  notes: (instance.notes || []).map((note: Note) => {
                    if (note.id === editingNote.id) {
                      return {
                        ...note,
                        stringValue: noteText.trim(),
                        addedAt: new Date().toISOString()
                      };
                    }
                    return note;
                  })
                };
              }
              return instance;
            });
          }

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

      setViewingProject({
        ...project,
        parts: updatedParts,
      });

      setEditingNote(null);
      setNoteText("");
    } catch (error) {
      console.error("Error updating note:", error);
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

  if (!project) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-xl font-bold text-red-800 mb-2">Hata</h2>
            <p className="text-red-700">Proje bulunamadı.</p>
            <Link href="/projects" className="mt-4 inline-block bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700">
              Projelere Dön
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const bgClass = statusBgColor[project.projectStatus || "devam ediyor"];

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{project.projectName}</h1>
          <div className="flex gap-4 mt-4">
            <Link href="/projects" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
              Projelere Dön
            </Link>
          </div>
        </div>

        {/* Alt Navigasyon Menüsü */}
        <div className="bg-white rounded-xl shadow-lg p-4 mb-8">
          <nav className="flex flex-wrap gap-4">
            <Link 
              href={`/projects/${projectId}/birlesimler`}
              className="px-4 py-2 text-gray-700 hover:bg-blue-50 rounded-lg transition-colors"
            >
              Birleşimler
            </Link>
            <Link 
              href={`/projects/${projectId}/civatalar`}
              className="px-4 py-2 text-gray-700 hover:bg-blue-50 rounded-lg transition-colors"
            >
              Cıvatalar
            </Link>
            <Link 
              href={`/projects/${projectId}/plakalar`}
              className="px-4 py-2 text-gray-700 hover:bg-blue-50 rounded-lg transition-colors"
            >
              Plakalar
            </Link>
            <Link 
              href={`/projects/${projectId}/profiller`}
              className="px-4 py-2 text-gray-700 hover:bg-blue-50 rounded-lg transition-colors"
            >
              Profiller
            </Link>
            <Link 
              href={`/projects/${projectId}/tum-parcalar`}
              className="px-4 py-2 text-gray-700 hover:bg-blue-50 rounded-lg transition-colors"
            >
              Tüm Parçalar
            </Link>
          </nav>
        </div>
        
        <div className="bg-white rounded-xl shadow-lg p-6 mb-5">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Görev İstatistikleri</h2>
            <div className="space-y-4">
              {/* Genel İlerleme */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold">Genel İlerleme</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">
                      {taskStats.completed}/{taskStats.total} Görev
                    </span>
                    <span className="text-sm text-gray-600">
                      ({taskStats.percentage?.toFixed(1) || 0}%)
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div 
                    className={`h-2.5 rounded-full transition-all duration-300 ${
                      !taskStats.percentage || taskStats.percentage === 0 ? 'bg-red-600' :
                      taskStats.percentage < 25 ? 'bg-orange-600' :
                      taskStats.percentage < 50 ? 'bg-yellow-600' :
                      taskStats.percentage < 75 ? 'bg-blue-600' :
                      taskStats.percentage < 100 ? 'bg-green-600' :
                      'bg-emerald-600'
                    }`}
                    style={{ width: `${taskStats.percentage || 0}%` }}
                  ></div>
                </div>
              </div>

              {/* Görev Tipi Bazlı İlerleme */}
              {Object.entries(taskStats.taskDetails).map(([taskName, stats]) => {
                const percentage = (stats.completed / stats.total) * 100;
                return (
                  <div key={taskName}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-semibold">{taskName}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">
                          {stats.completed}/{stats.total} Görev
                        </span>
                        <span className={`text-sm font-medium ${
                          percentage === 0 ? 'text-red-600' :
                          percentage < 25 ? 'text-orange-600' :
                          percentage < 50 ? 'text-yellow-600' :
                          percentage < 75 ? 'text-blue-600' :
                          percentage < 100 ? 'text-green-600' :
                          'text-emerald-600'
                        }`}>
                          ({percentage.toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div 
                        className={`h-2.5 rounded-full transition-all duration-300 ${
                          percentage === 0 ? 'bg-red-600' :
                          percentage < 25 ? 'bg-orange-600' :
                          percentage < 50 ? 'bg-yellow-600' :
                          percentage < 75 ? 'bg-blue-600' :
                          percentage < 100 ? 'bg-green-600' :
                          'bg-emerald-600'
                        }`}
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        {userData?.isAdmin && project && <UserStatsChart project={project} />}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-5">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Proje Bilgileri</h2>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-600">Proje Adı:</span>
                <span className="px-3 py-1 text-sm font-medium bg-blue-50 text-blue-800 rounded-full">
                  {project.projectName}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-600">Toplam Ağırlık:</span>
                <span className="px-3 py-1 text-sm font-medium bg-purple-50 text-purple-800 rounded-full">
                  {project.total_kg} kg
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-600">Durum:</span>
                <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                  project.projectStatus === 'beklemede' ? 'bg-yellow-50 text-yellow-800' :
                  project.projectStatus === 'devam ediyor' ? 'bg-green-50 text-green-800' :
                  'bg-red-50 text-red-800'
                }`}>
                  {project.projectStatus}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-600">Oluşturulma Tarihi:</span>
                <span className="px-3 py-1 text-sm font-medium bg-stone-50 text-stone-800 rounded-full">
                  {new Date(project.createdAt.seconds * 1000).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">İstatistikler</h2>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-600">Eşsiz Birleşim:</span>
                <span className="px-3 py-1 text-sm font-medium bg-blue-50 text-blue-800 rounded-full">
                  {Object.keys(project.assemblies || {}).length}
                </span>
            </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-600">Toplam Birleşim:</span>
                <span className="px-3 py-1 text-sm font-medium bg-blue-50 text-blue-800 rounded-full">
                  {Object.values(project.assemblies || {}).reduce((sum, assembly) => 
                    sum + (parseInt(assembly.qty) || 0), 0
                  )}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-600">Eşsiz Parça:</span>
                <span className="px-3 py-1 text-sm font-medium bg-purple-50 text-purple-800 rounded-full">
                  {project.parts?.length || 0}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-600">Toplam Parça:</span>
                <span className="px-3 py-1 text-sm font-medium bg-purple-50 text-purple-800 rounded-full">
                  {project.parts?.reduce((sum, part) => sum + (parseInt(part.qty) || 0), 0) || 0}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-600">Toplam Cıvata:</span>
                <span className="px-3 py-1 text-sm font-medium bg-stone-50 text-stone-800 rounded-full">
                  {project.bolts?.reduce((sum, bolt) => sum + (parseInt(bolt.qty) || 0), 0) || 0}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-600">Toplam Pul:</span>
                <span className="px-3 py-1 text-sm font-medium bg-stone-50 text-stone-800 rounded-full">
                  {project.washers?.reduce((sum, washer) => sum + (parseInt(washer.qty) || 0), 0) || 0}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-600">Toplam Somun:</span>
                <span className="px-3 py-1 text-sm font-medium bg-stone-50 text-stone-800 rounded-full">
                  {project.nuts?.reduce((sum, nut) => sum + (parseInt(nut.qty) || 0), 0) || 0}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-6 max-h-[500px] overflow-y-auto">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Son Yapılan Görevler</h2>
          <div className="space-y-4">
            {project.parts && Object.entries(
              project.parts.reduce((acc, part) => {
                Object.entries(part.assemblyInstances || {}).forEach(([assemblyId, instances]) => {
                  instances.forEach(instance => {
                    Object.entries(instance.tasks || {}).forEach(([taskName, task]) => {
                      if (task.isDone) {
                        const key = `${part.part}-${assemblyId}-${instance.id}-${taskName}`;
                        if (!acc[key]) {
                          acc[key] = {
                            partId: part.part,
                            assemblyId,
                            instanceId: instance.id,
                            taskName,
                            task
                          };
                        }
                      }
                    });
                  });
                });
                return acc;
              }, {} as Record<string, { partId: string; assemblyId: string; instanceId: number; taskName: string; task: TaskStatus }>)
            )
              .sort(([, a], [, b]) => new Date(b.task.doneAt || '').getTime() - new Date(a.task.doneAt || '').getTime())
              .map(([key, data]) => (
                <div key={key} className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <Link 
                        href={`/projects/${projectId}/partDetail/${data.partId}`}
                        className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                      >
                        {data.partId}
                      </Link>
                      <div className="flex flex-wrap gap-2">
                        <span className="px-2.5 py-1 text-xs font-medium bg-stone-100 text-stone-800 rounded-full">
                          {data.assemblyId}
                        </span>
                        <span className="px-2.5 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded-full">
                          Örnek #{data.instanceId}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <p className="text-sm font-medium text-gray-900 bg-green-50 text-green-800 px-3 py-1 rounded-full">
                        {data.task.doneBy}
                      </p>
                      <p className="text-sm text-gray-600">
                        {new Date(data.task.doneAt || '').toLocaleDateString('tr-TR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2">
                    <p className="text-sm text-gray-800 bg-white p-2 rounded border border-gray-100">
                      {data.taskName}
                    </p>
                  </div>
                </div>
              ))}
            {(!project.parts || project.parts.every(part => 
              Object.values(part.assemblyInstances || {}).every(instances => 
                instances.every(instance => 
                  Object.values(instance.tasks || {}).every(task => !task.isDone)
                )
              )
            )) && (
              <p className="text-gray-500 text-center py-4">Henüz tamamlanmış görev bulunmamaktadır.</p>
            )}
          </div>
        </div>

        {/* Son Bırakılan Notlar */}
        <div className="bg-white rounded-xl shadow-lg p-6 max-h-[500px] overflow-y-auto mt-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Son Bırakılan Notlar</h2>
          <div className="space-y-4">
            {project.parts && Object.entries(
              project.parts.reduce((acc, part) => {
                Object.entries(part.assemblyInstances || {}).forEach(([assemblyId, instances]) => {
                  instances.forEach(instance => {
                    if (instance.notes && instance.notes.length > 0) {
                      const key = `${part.part}-${assemblyId}-${instance.id}`;
                      if (!acc[key]) {
                        acc[key] = {
                          partId: part.part,
                          assemblyId,
                          instanceId: instance.id,
                          notes: []
                        };
                      }
                      acc[key].notes.push(...instance.notes);
                    }
                  });
                });
                return acc;
              }, {} as Record<string, { partId: string; assemblyId: string; instanceId: number; notes: Note[] }>)
            )
              .sort(([, a], [, b]) => {
                const aLatestNote = a.notes.sort((x, y) => new Date(y.addedAt).getTime() - new Date(x.addedAt).getTime())[0];
                const bLatestNote = b.notes.sort((x, y) => new Date(y.addedAt).getTime() - new Date(x.addedAt).getTime())[0];
                return new Date(bLatestNote.addedAt).getTime() - new Date(aLatestNote.addedAt).getTime();
              })
              .map(([key, data]) => (
                <div key={key} className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
                    <Link 
                      href={`/projects/${projectId}/partDetail/${data.partId}`}
                      className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                    >
                      {data.partId}
                    </Link>
                    <div className="flex flex-wrap gap-2">
                      <span className="px-2.5 py-1 text-xs font-medium bg-stone-100 text-stone-800 rounded-full">
                        {data.assemblyId}
                      </span>
                      <span className="px-2.5 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded-full">
                        Örnek #{data.instanceId}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {data.notes
                      .sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime())
                      .map((note, index) => (
                        <div key={`${key}-${index}`} className="bg-white p-3 rounded-lg border border-gray-100">
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                            <p className="text-sm text-gray-800 flex-1">{note.stringValue}</p>
                            <div className="flex flex-col items-end gap-1 min-w-[200px]">
                              <p className="text-sm font-medium text-gray-900 bg-green-50 text-green-800 px-3 py-1 rounded-full w-fit">
                                {note.addedBy}
                              </p>
                              <p className="text-sm text-gray-600">
                                {new Date(note.addedAt).toLocaleDateString('tr-TR', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            {(!project.parts || project.parts.every(part => 
              Object.values(part.assemblyInstances || {}).every(instances => 
                instances.every(instance => !instance.notes || instance.notes.length === 0)
              )
            )) && (
              <p className="text-gray-500 text-center py-4">Henüz bırakılmış not bulunmamaktadır.</p>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        <h2 className="text-2xl font-bold mb-4">
          {project.projectName} - Görevler
        </h2>

        {/* Arama ve Filtreleme */}
        <div className="mb-6">
          <div className="relative">
            <input
              type="text"
              placeholder="Parça adına göre ara..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div className="absolute right-3 top-2.5 text-gray-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {allParts
            .filter((part: Part) => 
              searchTerm === "" || 
              part.part.toLowerCase().includes(searchTerm.toLowerCase())
            )
            .map((part: Part) => {
            const instances = Object.entries(part.assemblyInstances || {}).flatMap(([assemblyId, instances]) => {
                return instances.map((instance: AssemblyInstance, index: number) => ({
                assemblyId,
                instanceNumber: index + 1,
                  tasks: instance.tasks || {},
                  notes: instance.notes || []
              }));
            });

            return instances.map((instance, idx) => {
              const taskStats = Object.entries(instance.tasks).reduce((acc, [taskName, status]) => {
                if ((status as TaskStatus).set) {
                  acc.total++;
                  if ((status as TaskStatus).isDone) {
                    acc.completed++;
                  }
                }
                return acc;
              }, { total: 0, completed: 0 });

              const progress = taskStats.total > 0 
                ? (taskStats.completed / taskStats.total) * 100 
                : 0;

              return (
                <div key={`${part.part}-${instance.assemblyId}-${instance.instanceNumber}`} 
                     className="rounded-lg p-6 bg-white shadow-sm hover:shadow-md transition-shadow duration-200">
                  <div className="flex justify-between items-start mb-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                          <Link 
                            href={`/projects/${projectId}/partDetail/${part.part}`}
                            className="font-bold text-lg text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            {part.part}
                          </Link>
                        <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                          {instance.assemblyId}
                        </span>
                        <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded-full">
                          Örnek #{instance.instanceNumber}
                        </span>
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
                    <div className="text-right">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">
                          {taskStats.completed}/{taskStats.total}
                        </span>
                        <span className="text-xs text-gray-500">Görev</span>
                      </div>
                      <div className={`text-sm font-medium ${
                        progress === 0 ? 'text-red-600' :
                        progress < 25 ? 'text-orange-600' :
                        progress < 50 ? 'text-yellow-600' :
                        progress < 75 ? 'text-blue-600' :
                        progress < 100 ? 'text-green-600' :
                        'text-emerald-600'
                      }`}>
                        {progress.toFixed(1)}%
                      </div>
                        <div className="flex justify-end">
                          <button
                            onClick={() => {
                              setSelectedPart({
                                partId: part.part,
                                assemblyId: instance.assemblyId,
                                instanceId: instance.instanceNumber
                              });
                              setIsNoteModalOpen(true);
                            }}
                            className="ml-2 text-xs text-blue-600 hover:text-blue-800 flex flex-row gap-1"
                          >Not
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                            </svg>
                          </button>
                        </div>
                    </div>
                  </div>

                  {/* Progress Bar - Only show if there are tasks */}
                  {taskStats.total > 0 && (
                    <div className="w-full bg-gray-100 rounded-full h-2.5 mb-6">
                      <div 
                        className={`h-2.5 rounded-full transition-all duration-300 ${
                          progress === 0 ? 'bg-red-600' :
                          progress < 25 ? 'bg-orange-600' :
                          progress < 50 ? 'bg-yellow-600' :
                          progress < 75 ? 'bg-blue-600' :
                          progress < 100 ? 'bg-green-600' :
                          'bg-emerald-600'
                        }`}
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                  )}

                  {/* Tasks */}
                  <div className="space-y-3">
                    {(() => {
                      const assignedTasks = Object.entries(instance.tasks).filter(([_, status]) => 
                        (status as TaskStatus).set
                      );

                        if (assignedTasks.length === 0) return null;

                      return assignedTasks.map(([task, status]) => {
                        const taskStatus = status as TaskStatus;
                        const isDoneByCurrentUser = taskStatus.doneBy === `${userData?.firstName} ${userData?.lastName}`;
                        const isDisabled = taskStatus.isDone && !isDoneByCurrentUser && !userData?.isAdmin;
                        
                        return (
                          <div key={task} 
                               className={`flex items-center gap-3 p-2 rounded-lg transition-colors duration-200
                                         ${taskStatus.isDone ? 'bg-green-50' : 'bg-gray-50 hover:bg-gray-100'}`}>
                            <input
                              type="checkbox"
                              checked={taskStatus.isDone}
                              onChange={(e) =>
                                updateTaskStatus(
                                  part.part,
                                  task,
                                  instance.assemblyId,
                                  instance.instanceNumber,
                                  {
                                    ...taskStatus,
                                    isDone: e.target.checked,
                                  }
                                )
                              }
                              disabled={!taskStatus.set || isDisabled}
                              className={`w-4 h-4 rounded
                                        ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                                        ${taskStatus.isDone ? 'text-green-600' : 'text-blue-600'}`}
                            />
                            <div className="flex-1 min-w-0">
                              <span className={`text-sm font-medium ${taskStatus.isDone ? 'text-green-700' : 'text-gray-700'}`}>
                                {task}
                              </span>
                              {taskStatus.doneBy && (
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-xs text-gray-500">
                                    {taskStatus.doneBy}
                                  </span>
                                  <span className="text-xs text-gray-400">•</span>
                                  <span className="text-xs text-gray-500">
                                    {new Date(taskStatus.doneAt || '').toLocaleDateString('tr-TR', {
                                      day: '2-digit',
                                      month: '2-digit',
                                      year: '2-digit',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </span>
                                </div>
                              )}
                            </div>
                            {taskStatus.isDone && (
                              <span className="text-green-600">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                </svg>
                              </span>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>

                    {/* Notlar Bölümü */}
                    {instance.notes && instance.notes.length > 0 && (
                    <div className="mt-4 border-t border-gray-100 pt-4">
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="text-sm font-medium text-gray-700">Notlar</h4>
                      </div>
                      
                      {instance.notes && instance.notes.length > 0 && (
                        <div className="space-y-2">
                          {instance.notes.map((note: Note) => (
                            <div key={note.id} className="bg-gray-50 p-3 rounded-lg mb-2">
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <p className="text-sm text-gray-700">{note.stringValue}</p>
                                  <div className="mt-1 text-xs text-gray-500">
                                    <span>{note.addedBy}</span>
                                    <span className="mx-2">•</span>
                                    <span>{new Date(note.addedAt).toLocaleString('tr-TR')}</span>
                                  </div>
                                </div>
                                {(userData?.isAdmin || note.addedBy === `${userData?.firstName} ${userData?.lastName}`) && (
                                  <div className="flex gap-2 ml-2">
                                    <button
                                      onClick={() => {
                                        setEditingNote(note);
                                        setNoteText(note.stringValue);
                                        setSelectedPart({
                                          partId: part.part,
                                          assemblyId: instance.assemblyId,
                                          instanceId: instance.instanceNumber
                                        });
                                      }}
                                      className="text-blue-600 hover:text-blue-800"
                                    >
                                      Düzenle
                                    </button>
                                    <button
                                      onClick={() => note.id && handleDeleteNote(note.id, part.part, instance.assemblyId, instance.instanceNumber)}
                                      className="text-red-600 hover:text-red-800"
                                    >
                                      Sil
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    )}
                </div>
              );
            });
          })}
        </div>
      </div>

      {/* Not Ekleme/Düzenleme Modalı */}
      {isNoteModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              {editingNote ? 'Notu Düzenle' : 'Not Ekle'}
            </h3>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Notunuzu buraya yazın..."
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => {
                  setIsNoteModalOpen(false);
                  setSelectedPart(null);
                  setNoteText("");
                  setEditingNote(null);
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                İptal
              </button>
              <button
                onClick={editingNote ? handleUpdateNote : handleAddNote}
                className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                {editingNote ? 'Güncelle' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
