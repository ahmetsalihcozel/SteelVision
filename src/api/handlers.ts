import { User } from 'firebase/auth';
import { doc, collection, setDoc, serverTimestamp, getDoc, updateDoc, getDocs, query, where, Timestamp } from "firebase/firestore";
import { db } from "./firebase";
import { Project, ProjectStatus, ProcessTime, ProcessStatusType, ProcessStatusChange, Part, Assembly, TaskStatus, UserData } from "@/types/types";
import { loginUser, registerUser, createUserDocument, logoutUser, getProject, updateProject, deleteProject, getFileUrl, checkRegisterKey } from "./firebase";

// Auth Handlers
export const handleLogin = async (email: string, password: string) => {
  try {
    const result = await loginUser(email, password);
    if (!result.user) throw new Error('Login failed');
    return { success: true, user: result.user };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const handleRegister = async (email: string, password: string, firstName: string, lastName: string) => {
  try {
    const result = await registerUser(email, password);
    if (!result.user) throw new Error('Registration failed');
    const userData: UserData = { email, firstName, lastName, isAdmin: false };
    await createUserDocument(result.user.uid, userData);
    return { success: true, user: result.user };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const handleLogout = async () => {
  try {
    await logoutUser();
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

// Project Handlers
export const handleCreateProject = async (
  projectData: Omit<Project, "id">,
  files: {
    coverImage?: File;
    parcaFiles?: FileList;
    birlesimFiles?: FileList;
  }
): Promise<{ success: boolean; projectId?: string; error?: string }> => {
  try {
    console.log("📦 Received project data:", projectData);

    // Validate required fields
    if (!projectData.projectName) {
      throw new Error("Proje adı gereklidir.");
    }

    if (!projectData.total_kg || isNaN(projectData.total_kg)) {
      throw new Error("Geçerli bir toplam ağırlık gereklidir.");
    }

    // Ensure all required fields exist
    const processedData = {
      ...projectData,
      parts: Array.isArray(projectData.parts) ? projectData.parts : [],
      assemblies: projectData.assemblies || {},
      total_kg: projectData.total_kg || 0,
      projectStatus: projectData.projectStatus || "beklemede",
      createdAt: projectData.createdAt || {
        seconds: Math.floor(Date.now() / 1000),
        nanoseconds: 0
      },
      processTime: {
        statusChanges: [
          {
            type: 'start' as ProcessStatusType,
            date: new Date().toISOString(),
            workerCount: 1, // Varsayılan olarak 1 işçi ile başlat
            notes: 'Proje başlatıldı'
          }
        ]
      }
    };

    console.log("📦 Processed data structure:", processedData);

    // Process parts to ensure they have all required fields
    processedData.parts = processedData.parts.map(part => {
      if (!part.part || !part.qty) {
        console.warn("⚠️ Invalid part found:", part);
      }
      return {
        ...part,
        assemblyInstances: part.assemblyInstances || {}
      };
    });

    console.log("📦 Final processed data with parts:", processedData);

    // Process assemblies to ensure they have all required fields
    Object.entries(processedData.assemblies).forEach(([assemblyId, assembly]) => {
      if (!assembly) {
        console.warn(`⚠️ Invalid assembly found for ID: ${assemblyId}`);
        return;
      }

      if (!Array.isArray(assembly.parts)) {
        console.warn(`⚠️ Invalid parts array in assembly: ${assemblyId}`);
        assembly.parts = [];
        return;
      }

      assembly.parts = assembly.parts.map(part => {
        if (!part.part || !part.qty) {
          console.warn(`⚠️ Invalid part found in assembly ${assemblyId}:`, part);
        }
        return {
          ...part,
          assemblyInstances: part.assemblyInstances || {}
        };
      });
    });

    console.log("📦 Final processed data:", processedData);

    return await createProject(processedData);
  } catch (error) {
    console.error("❌ Error in handleCreateProject:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Proje oluşturulurken bir hata oluştu"
    };
  }
};

export const handleDeleteProject = async (projectId: string) => {
  try {
    await deleteProject(projectId);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const handleUpdateProjectStatus = async (projectId: string, status: Project['projectStatus']) => {
  try {
    await updateProject(projectId, { projectStatus: status });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const handleUpdateTaskStatus = async (
  projectId: string,
  partId: string,
  assemblyId: string,
  taskName: string,
  status: TaskStatus,
  user: User
) => {
  try {
    const project = await getProject(projectId);
    if (!project) throw new Error('Project not found');

    const updatedParts = project.parts.map((part: Part) => {
      if (part.part === partId) {
        const updatedTask: TaskStatus = {
          ...status,
          doneBy: user.displayName || user.email || undefined,
          doneAt: new Date().toISOString(),
        };
        const assemblyInstances = { ...part.assemblyInstances };
        if (assemblyInstances[taskName]) {
          assemblyInstances[taskName] = assemblyInstances[taskName].map((instance: { id: number; tasks: Record<string, TaskStatus> }) => ({
            ...instance,
            tasks: {
              ...instance.tasks,
              [taskName]: updatedTask
            }
          }));
        }
        return {
          ...part,
          assemblyInstances
        } as Part;
      }
      return part;
    });

    await updateProject(projectId, { parts: updatedParts });
    return { success: true, updatedParts };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const handleAssignTasksToPart = async (
  projectId: string,
  partId: string,
  tasks: string[],
  user: User
) => {
  try {
    const project = await getProject(projectId);
    if (!project) throw new Error('Project not found');

    // Find all assemblies containing this part
    const assembliesWithPart = (Object.entries(project.assemblies) as [string, Assembly][])
      .filter(([_, assembly]) => assembly.parts.some((p: Part) => p.part === partId))
      .map(([id]) => id);

    const updatedParts = project.parts.map((part: Part) => {
      if (part.part === partId) {
        const updatedAssemblyTasks = { ...part.assemblyInstances };
        
        // Update tasks for each assembly containing this part
        assembliesWithPart.forEach(assemblyId => {
          updatedAssemblyTasks[assemblyId] = {
            ...updatedAssemblyTasks[assemblyId],
            ...tasks.reduce((acc, task) => ({
              ...acc,
              [task]: {
                set: true,
                isDone: false,
                doneBy: undefined,
                doneAt: undefined,
              },
            }), {}),
          };
        });

        return {
          ...part,
          assemblyInstances: updatedAssemblyTasks,
        };
      }
      return part;
    });

    await updateProject(projectId, { parts: updatedParts });
    return { success: true, updatedParts };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

// File Handlers
export const handleGetFileUrl = async (path: string) => {
  try {
    const url = await getFileUrl(path);
    return { success: true, url };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const createProject = async (projectData: Omit<Project, "id" | "createdAt" | "updatedAt">) => {
  try {
    const projectRef = doc(collection(db, "projects"));
    const now = Timestamp.now();
    
    const processTime: ProcessTime = {
      statusChanges: [{
        type: 'start' as ProcessStatusType,
        date: now.toDate().toISOString(),
        workerCount: 1,
        notes: 'Proje başlatıldı'
      }]
    };

    const project: Project = {
      ...projectData,
      id: projectRef.id,
      createdAt: {
        seconds: now.seconds,
        nanoseconds: now.nanoseconds
      },
      processTime
    };

    await setDoc(projectRef, project);
    return { success: true, projectId: projectRef.id };
  } catch (error) {
    console.error("Error creating project:", error);
    return { success: false, error: (error as Error).message };
  }
};

export const updateProjectStatus = async (
  projectId: string,
  statusType: ProcessStatusType,
  workerCount?: number,
  notes?: string
) => {
  try {
    const projectRef = doc(db, "projects", projectId);
    const projectDoc = await getDoc(projectRef);
    
    if (!projectDoc.exists()) {
      throw new Error("Project not found");
    }

    const project = projectDoc.data() as Project;
    const statusChange: ProcessStatusChange = {
      type: statusType,
      date: new Date().toISOString(),
      notes
    };

    if (statusType === 'start' || statusType === 'continue') {
      if (!workerCount) {
        throw new Error("Worker count is required for start and continue status");
      }
      statusChange.workerCount = workerCount;
    }

    const newStatus = statusType === 'finish' ? 'bitti' :
                     statusType === 'suspend' ? 'beklemede' :
                     'devam ediyor';

    await updateDoc(projectRef, {
      projectStatus: newStatus,
      processTime: {
        statusChanges: [
          ...(project.processTime?.statusChanges || []),
          statusChange
        ]
      }
    });

    return { success: true };
  } catch (error) {
    console.error("Error updating project status:", error);
    return { success: false, error: (error as Error).message };
  }
};

export const getProjectById = async (projectId: string) => {
  try {
    const projectRef = doc(db, "projects", projectId);
    const projectDoc = await getDoc(projectRef);
    
    if (!projectDoc.exists()) {
      throw new Error("Project not found");
    }

    return projectDoc.data() as Project;
  } catch (error) {
    console.error("Error getting project:", error);
    throw error;
  }
};

export const getAllProjects = async () => {
  try {
    const projectsRef = collection(db, "projects");
    const projectsSnapshot = await getDocs(projectsRef);
    
    return projectsSnapshot.docs.map(doc => doc.data() as Project);
  } catch (error) {
    console.error("Error getting projects:", error);
    throw error;
  }
}; 