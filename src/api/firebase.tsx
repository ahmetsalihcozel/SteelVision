import { initializeApp, getApps } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, User } from "firebase/auth";
import { getFirestore, collection, getDocs, doc, getDoc, updateDoc, deleteDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { Project, UserData } from "@/types/types";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export const loginUser = async (email: string, password: string) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return { success: true, user: userCredential.user };
  } catch (error) {
    return { success: false, error };
  }
};

export const registerUser = async (email: string, password: string) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    return { success: true, user: userCredential.user };
  } catch (error) {
    return { success: false, error };
  }
};

export const logoutUser = async () => {
  try {
    if (!auth) {
      throw new Error("Firebase auth instance bulunamadı");
    }

    await signOut(auth);

    try {
      localStorage.removeItem('user');
    } catch (storageError) {
    }

    console.log("4️⃣ Session storage temizleniyor...");
    try {
      sessionStorage.clear();
    } catch (sessionError) {
    }

    return { success: true };
  } catch (error) {
    
    if (error instanceof Error) {
      const errorMessage = error.message;
      console.error("Hata detayları:", {
        message: errorMessage,
        name: error.name,
        stack: error.stack
      });

      if (errorMessage.includes("auth/")) {
        const errorCode = errorMessage.split("auth/")[1];
      }
    }

    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Çıkış yapılırken bir hata oluştu",
      details: error instanceof Error ? {
        name: error.name,
        stack: error.stack
      } : undefined
    };
  }
};

export const createProject = async (
  projectData: Omit<Project, "id">,
  files: {
    coverImage?: File;
    parcaFiles?: FileList;
    birlesimFiles?: FileList;
  }
): Promise<{ success: boolean; projectId?: string; error?: string }> => {
  try {
    
    const projectRef = doc(collection(db, "projects"));
    const projectId = projectRef.id;

    try {
      if (files.coverImage) {
        const coverImagePath = `projects/${projectId}/${files.coverImage.name}`;
        const coverImageRef = ref(storage, coverImagePath);
        await uploadBytes(coverImageRef, files.coverImage);
        const coverImageUrl = await getDownloadURL(coverImageRef);
        projectData.coverImageUrl = coverImageUrl;
      }

      if (files.parcaFiles && files.parcaFiles.length > 0) {
        const parcaUrls = await Promise.all(
          Array.from(files.parcaFiles).map(async (file) => {
            const cleanedFileName = file.name.replace(/\s*-\s*STANDARD\.pdf$/i, ".pdf");
            const path = `projects/${projectId}/Parcalar/${cleanedFileName}`;
            const fileRef = ref(storage, path);
            await uploadBytes(fileRef, file);
            return getDownloadURL(fileRef);
          })
        );
        projectData.parcaUrls = parcaUrls;
      }

      if (files.birlesimFiles && files.birlesimFiles.length > 0) {
        const birlesimUrls = await Promise.all(
          Array.from(files.birlesimFiles).map(async (file) => {
            const cleanedFileName = file.name.replace(/\s*-\s*STANDARD\.pdf$/i, ".pdf");
            const path = `projects/${projectId}/Birlesimler/${cleanedFileName}`;
            const fileRef = ref(storage, path);
            await uploadBytes(fileRef, file);
            return getDownloadURL(fileRef);
          })
        );
        projectData.birlesimUrls = birlesimUrls;
      }
    } catch (uploadError) {
      throw new Error("Dosya yüklenirken bir hata oluştu: " + (uploadError instanceof Error ? uploadError.message : "Bilinmeyen hata"));
    }

    if (!projectData.parts) {
      projectData.parts = [];
    }

    if (!projectData.assemblies) {
      projectData.assemblies = {};
    }

    projectData.parts = projectData.parts.map(part => {
      if (!part.part || !part.qty) {
        console.warn("⚠️ Invalid part found:", part);
      }
      return {
        ...part,
        assemblyInstances: part.assemblyInstances || {}
      };
    });

    Object.entries(projectData.assemblies).forEach(([assemblyId, assembly]) => {
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

    console.log("💾 Saving project to Firestore...");
    console.log("📦 Final project data before saving:", {
      ...projectData,
      id: projectId,
    });
    await setDoc(projectRef, {
      ...projectData,
      id: projectId,
    });
    console.log("✅ Project saved successfully");

    return { success: true, projectId };
  } catch (error) {
    console.error("❌ Error creating project:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Proje oluşturulurken bir hata oluştu"
    };
  }
};

export const getProject = async (projectId: string): Promise<Project | null> => {
  try {
    const projectRef = doc(db, "projects", projectId);
    const projectDoc = await getDoc(projectRef);
    
    if (projectDoc.exists()) {
      return projectDoc.data() as Project;
    }
    return null;
  } catch (error) {
    console.error("Error getting project:", error);
    throw error;
  }
};

export const updateProject = async (
  projectId: string,
  updates: Partial<Project>
): Promise<{ success: boolean; error?: string }> => {
  try {
    const projectRef = doc(db, "projects", projectId);
    await updateDoc(projectRef, updates);
    return { success: true };
  } catch (error) {
    console.error("Error updating project:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Proje güncellenirken bir hata oluştu"
    };
  }
};

export const deleteProject = async (projectId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const projectRef = doc(db, "projects", projectId);
    const projectDoc = await getDoc(projectRef);
    
    if (projectDoc.exists()) {
      const projectData = projectDoc.data() as Project;
      
      if (projectData.coverImageUrl) {
        const coverImageRef = ref(storage, projectData.coverImageUrl);
        await deleteObject(coverImageRef);
      }

      if (projectData.parcaUrls) {
        await Promise.all(
          projectData.parcaUrls.map(url => deleteObject(ref(storage, url)))
        );
      }

      if (projectData.birlesimUrls) {
        await Promise.all(
          projectData.birlesimUrls.map(url => deleteObject(ref(storage, url)))
        );
      }

      await deleteDoc(projectRef);
      return { success: true };
    }
    
    return { success: false, error: "Proje bulunamadı" };
  } catch (error) {
    console.error("Error deleting project:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Proje silinirken bir hata oluştu"
    };
  }
};

export const getAllProjects = async (): Promise<Project[]> => {
  try {
    const projectsRef = collection(db, "projects");
    const projectsSnapshot = await getDocs(projectsRef);
    return projectsSnapshot.docs.map(doc => doc.data() as Project);
  } catch (error) {
    console.error("Error getting all projects:", error);
    throw error;
  }
};

export const uploadFile = async (path: string, file: File) => {
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
};

export const getFileUrl = async (path: string) => {
  const storageRef = ref(storage, path);
  return getDownloadURL(storageRef);
};

export const createUserDocument = async (uid: string, userData: UserData) => {
  const userRef = doc(db, "users", uid);
  await setDoc(userRef, {
    ...userData,
    createdAt: serverTimestamp(),
  });
};

export const getUserDocument = async (uid: string) => {
  const userRef = doc(db, "users", uid);
  const userSnap = await getDoc(userRef);
  return userSnap.exists() ? userSnap.data() : null;
};

export const getDefaultTasks = async (): Promise<Record<string, { set: boolean; isDone: boolean }>> => {
  try {
    const configRef = doc(db, "configurations", "Pe1vgl6aRhjs4Zp4CqfZ");
    const configSnap = await getDoc(configRef);
    
    if (configSnap.exists()) {
      const tasks = configSnap.data().tasks || [];
      return tasks.reduce((acc: Record<string, { set: boolean; isDone: boolean }>, task: string) => {
        acc[task] = { set: false, isDone: false };
        return acc;
      }, {});
    }
    return {};
  } catch (error) {
    console.error("Error getting default tasks:", error);
    return {};
  }
};

export const getSiteUrl = async (): Promise<string> => {
  try {
    const configRef = doc(db, "configurations", "Pe1vgl6aRhjs4Zp4CqfZ");
    const configSnap = await getDoc(configRef);
    
    if (configSnap.exists()) {
      return configSnap.data().siteURL || "http://localhost:3000";
    }
    return "http://localhost:3000";
  } catch (error) {
    console.error("Error getting site URL:", error);
    return "http://localhost:3000";
  }
};

export const checkRegisterKey = async (key: string): Promise<boolean> => {
  try {
    const configRef = doc(db, "configurations", "Pe1vgl6aRhjs4Zp4CqfZ");
    const configSnap = await getDoc(configRef);
    
    if (configSnap.exists()) {
      const registerKey = configSnap.data().registerKey;
      return key === registerKey;
    }
    return false;
  } catch (error) {
    console.error("Error checking register key:", error);
    return false;
  }
};

export { auth, db, storage };