export type UserRole = 'admin' | 'user';

export type ProjectStatus = "beklemede" | "devam ediyor" | "bitti";

export interface TaskStatus {
  set: boolean;
  isDone: boolean;
  doneBy?: string;
  doneAt?: string;
}

export interface AssemblyInstance {
  id: number;
  tasks: Record<string, TaskStatus>;
  notes?: Note[];
}

export interface Note {
  id?: string;
  addedBy: string;
  addedAt: string;
  stringValue: string;
}

export interface Part {
  part: string;
  qty: string;
  profile: string;
  grade: string;
  length_mm: string;
  weight_kg: string;
  assemblyInstances: Record<string, AssemblyInstance[]>;
  defaultTasks?: Record<string, TaskStatus>;
  assemblyTasks?: Record<string, Record<string, TaskStatus>>;
  tasks?: string[];
}

export interface Assembly {
  qty: string;
  weight_kg: string;
  total_weight_kg?: string | number;
  parts: Part[];
  tasks?: string[];
}

export interface Project {
  id: string;
  projectName: string;
  total_kg: number;
  projectStatus: ProjectStatus;
  createdAt: {
    seconds: number;
    nanoseconds: number;
  };
  updatedAt?: {
    seconds: number;
    nanoseconds: number;
  };
  assemblies: Record<string, Assembly>;
  parts: Part[];
  bolts: Fastener[];
  washers: Fastener[];
  nuts: Fastener[];
  coverImageUrl?: string;
  parcaUrls?: string[];
  birlesimUrls?: string[];
  processTime?: ProcessTime;
}

export interface UserData {
  email: string;
  firstName: string;
  lastName: string;
  isAdmin: boolean;
  createdAt?: Date;
}

export interface Fastener {
  size: string;
  qty: string;
  name: string;
}

export type ProcessStatusType = 'start' | 'continue' | 'suspend' | 'finish';

export interface ProcessStatusChange {
  type: ProcessStatusType;
  date: string;
  workerCount?: number;
  notes?: string;
}

export interface ProcessTime {
  statusChanges: ProcessStatusChange[];
}

export type ParsedData = Record<string, Assembly>;

export interface CreateProjectFormProps {
  assemblies?: Record<string, Assembly>;
  parts?: Part[];
  total_kg?: number;
  bolts?: any[];
}

export interface AggregatedPartsTableProps {
  data: ParsedData;
  onSaveTasks?: (updatedData: ParsedData) => void;
}

export interface XsrStore {
  viewingProject: Project | null;
  setViewingProject: (project: Project) => void;
  parsedData: ParsedData | null;
  setParsedData: (data: ParsedData) => void;
} 