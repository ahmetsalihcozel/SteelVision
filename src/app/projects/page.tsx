"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { getDownloadURL, ref } from "firebase/storage";
import { db, storage } from "@/api/firebase";
import withAuth from "@/hoc/withAuth";
import { useXsrStore } from "@/stores/xsrStore";
import { useRouter } from "next/navigation";

type Status = "beklemede" | "devam ediyor" | "bitti";

interface Project {
  id: string;
  projectName: string;
  total_kg: number;
  projectStatus?: Status;
  createdAt: {
    seconds: number;
    nanoseconds: number;
  };
  coverUrl?: string;
}

const statusClasses: Record<Status, { bg: string; text: string }> = {
  beklemede: { bg: "bg-yellow-300", text: "text-yellow-700" },
  "devam ediyor": { bg: "bg-green-300", text: "text-green-700" },
  bitti: { bg: "bg-red-300", text: "text-red-700" },
};

function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const router = useRouter();
  const setViewingProject = useXsrStore((state) => state.setViewingProject);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const snapshot = await getDocs(collection(db, "projects"));
        const data: Project[] = await Promise.all(
          snapshot.docs.map(async (docSnap) => {
            const docData = docSnap.data();
            let coverUrl = "";
            try {
              coverUrl = await getDownloadURL(ref(storage, `projects/${docSnap.id}/cover.png`));
            } catch {
            }

            return {
              id: docSnap.id,
              projectName: docData.projectName,
              total_kg: docData.total_kg,
              projectStatus: docData.projectStatus,
              createdAt: docData.createdAt,
              coverUrl,
            };
          })
        );

        setProjects(data);
      } catch (err) {
        console.error("Projeler alınamadı:", err);
        setError("Projeler alınırken bir hata oluştu.");
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, []);

  const handleProjectSelect = async (projectId: string) => {
    try {
      const docRef = doc(db, "projects", projectId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const fullProjectData = docSnap.data();

        setViewingProject({
          id: projectId,
          projectName: fullProjectData.projectName,
          total_kg: fullProjectData.total_kg,
          projectStatus: fullProjectData.projectStatus,
          createdAt: fullProjectData.createdAt,
          assemblies: fullProjectData.assemblies || {},
          parts: fullProjectData.parts || [],
          bolts: fullProjectData.bolts || [],
          washers: fullProjectData.washers || [],
          nuts: fullProjectData.nuts || []
        });

        router.push(`/projects/${projectId}`);
      } else {
        console.error("Proje bulunamadı.");
      }
    } catch (err) {
      console.error("Projeyi alırken hata:", err);
    }
  };

  if (loading) return <p>Yükleniyor...</p>;
  if (error) return <p className="text-red-600">{error}</p>;
  if (projects.length === 0) return <p>Henüz bir proje oluşturulmamış.</p>;

  return (
    <section className="p-8 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Projeler</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => {
          const status = project.projectStatus || "devam ediyor";
          const { bg, text } = statusClasses[status];

          return (
            <div
              key={project.id}
              onClick={() => handleProjectSelect(project.id)}
              className={`${bg} p-4 rounded shadow cursor-pointer hover:shadow-lg transition`}
            >
              {project.coverUrl && (
                <img
                  src={project.coverUrl}
                  alt="Kapak Resmi"
                  className="w-full h-40 object-cover rounded mb-2"
                />
              )}
              <h2 className="text-lg font-semibold">{project.projectName}</h2>
              <p className="text-sm text-gray-600">
                Toplam Ağırlık: <strong>{project.total_kg} kg</strong>
              </p>
              <p className="text-sm text-gray-400">
                Oluşturulma: {new Date(project.createdAt.seconds * 1000).toLocaleDateString()}
              </p>
              <p className={`mt-2 font-semibold ${text}`}>Durum: {status}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default withAuth(ProjectsPage);
