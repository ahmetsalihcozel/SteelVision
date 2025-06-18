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
  text: string;
  partId: string;
  assemblyId: string;
  instanceId: number;
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

export interface Bolt {
  size: string;
  qty: string;
  name: string;
}

export interface Washer {
  size: string;
  qty: string;
  name: string;
}

export interface Nut {
  size: string;
  qty: string;
  name: string;
}

export interface Project {
  id: string;
  projectName: string;
  projectStatus: string;
  total_kg: number;
  createdAt: any;
  parts: Part[];
  assemblies: { [key: string]: Assembly };
  bolts?: Bolt[];
  washers?: Washer[];
  nuts?: Nut[];
  notes?: { [key: string]: Note };
  coverImageUrl?: string;
  parcaUrls?: string[];
  birlesimUrls?: string[];
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