"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { getDownloadURL, ref, deleteObject, listAll } from "firebase/storage";
import { db, storage } from "@/api/firebase";
import withAdmin from "@/hoc/withAdmin";
import Link from "next/link";

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

const STATUS_OPTIONS: Status[] = ["beklemede", "devam ediyor", "bitti"];

const statusBgColor: Record<Status, string> = {
  beklemede: "bg-yellow-300",
  "devam ediyor": "bg-green-300",
  bitti: "bg-red-300",
};

function ProjectsAdminPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchProjects = async () => {
    setLoading(true);
    setError("");
    try {
      const snapshot = await getDocs(collection(db, "projects"));
      const data: Project[] = await Promise.all(
        snapshot.docs.map(async (docSnap) => {
          const data = docSnap.data() as Omit<Project, "id" | "coverUrl">;
          let coverUrl = "";

          try {
            coverUrl = await getDownloadURL(ref(storage, `projects/${docSnap.id}/cover.png`));
          } catch {
            // coverUrl boş kalabilir, sorun değil
          }

          return {
            id: docSnap.id,
            ...data,
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

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Projeyi silmek istediğinize emin misiniz?")) return;

    setActionLoading(id);
    try {
      // Storage'daki dosyaları sil
      const storageRef = ref(storage, `projects/${id}`);
      try {
        // Önce klasördeki tüm dosyaları listele
        const result = await listAll(storageRef);
        
        // Tüm dosyaları sil
        const deletePromises = result.items.map(item => deleteObject(item));
        await Promise.all(deletePromises);

        // Alt klasörlerdeki dosyaları da sil
        const folderPromises = result.prefixes.map(async (folderRef) => {
          const folderResult = await listAll(folderRef);
          const folderDeletePromises = folderResult.items.map(item => deleteObject(item));
          await Promise.all(folderDeletePromises);
        });
        await Promise.all(folderPromises);
      } catch (error) {
        console.error("Storage temizliği sırasında hata:", error);
      }

      // Firestore'dan projeyi sil
      await deleteDoc(doc(db, "projects", id));
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      alert("Proje silinemedi.");
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleStatusChange = async (id: string, newStatus: Status) => {
    setActionLoading(id);
    try {
      await updateDoc(doc(db, "projects", id), {
        projectStatus: newStatus,
      });

      setProjects((prev) =>
        prev.map((p) => (p.id === id ? { ...p, projectStatus: newStatus } : p))
      );
    } catch (err) {
      alert("Proje durumu güncellenemedi.");
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <section className="p-8 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Projeler (Admin)</h1>

      {loading && <p>Yükleniyor...</p>}
      {error && <p className="text-red-600">{error}</p>}

      {!loading && !error && projects.length === 0 && (
        <p>Henüz bir proje oluşturulmamış.</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => {
          const status: Status = project.projectStatus ?? "devam ediyor";
          const bgClass = statusBgColor[status];

          return (
            <div
              key={project.id}
              className={`${bgClass} p-4 rounded shadow flex flex-col justify-between`}
            >
              <div>
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
                <p className="text-sm text-gray-400 mb-2">
                  Oluşturulma:{" "}
                  {new Date(project.createdAt.seconds * 1000).toLocaleDateString()}
                </p>

                <label htmlFor={`status-${project.id}`} className="block mb-1 font-semibold text-sm">
                  Durum:
                </label>
                <select
                  id={`status-${project.id}`}
                  disabled={actionLoading === project.id}
                  value={status}
                  onChange={(e) => handleStatusChange(project.id, e.target.value as Status)}
                  className="border rounded p-1 w-full"
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option.charAt(0).toUpperCase() + option.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  disabled={actionLoading === project.id}
                  onClick={() => handleDelete(project.id)}
                  className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded disabled:opacity-50"
                >
                  {actionLoading === project.id ? "Siliniyor..." : "Projeyi Sil"}
                </button>

                <Link
                  href={`/projects-admin-page/${project.id}`}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded"
                >
                  Projeye Git
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default withAdmin(ProjectsAdminPage);
