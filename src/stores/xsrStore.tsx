import { Assembly, Project } from "@/types/types";
import { create } from "zustand";

interface XsrStore {
  viewingProject: Project | null;
  setViewingProject: (project: Project) => void;
  
  parsedData: Record<string, Assembly> | null;
  setParsedData: (data: Record<string, Assembly>) => void;
}

export const useXsrStore = create<XsrStore>((set) => ({
  viewingProject: null,
  setViewingProject: (project) => set({ viewingProject: project }),

  parsedData: null,
  setParsedData: (data) => set({ parsedData: data }),
}));
