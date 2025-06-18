"use client";

import { useEffect, useState } from "react";
import { getProject } from "@/api/firebase";
import { Project } from "@/types/types";
import { useParams } from "next/navigation";
import Link from "next/link";

export default function ProjectBoltsPage() {
  const { id } = useParams();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProject = async () => {
      try {
        const projectData = await getProject(id as string);
        setProject(projectData);
      } catch (error) {
        console.error("Error fetching project:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProject();
  }, [id]);

  if (loading) {
    return <div className="min-h-screen bg-gray-50 py-12">Yükleniyor...</div>;
  }

  if (!project) {
    return <div className="min-h-screen bg-gray-50 py-12">Proje bulunamadı.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{project.projectName} - Cıvatalar</h1>
          <div className="flex gap-4 mt-4">
            <Link href={`/projects/${id}`} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
              Projeye Dön
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Cıvatalar */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Cıvatalar</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Parça No</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Adet</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Adı</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {project.bolts?.map((bolt, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{bolt.size}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{bolt.qty}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{bolt.name}</td>
                    </tr>
                  )) || (
                    <tr>
                      <td colSpan={3} className="px-6 py-4 text-center text-gray-500">
                        Henüz cıvata eklenmemiş
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pullar */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Pullar</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Parça No</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Adet</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Adı</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {project.washers?.map((washer, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{washer.size}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{washer.qty}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{washer.name}</td>
                    </tr>
                  )) || (
                    <tr>
                      <td colSpan={3} className="px-6 py-4 text-center text-gray-500">
                        Henüz pul eklenmemiş
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Somunlar */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Somunlar</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Parça No</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Adet</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Adı</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {project.nuts?.map((nut, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{nut.size}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{nut.qty}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{nut.name}</td>
                    </tr>
                  )) || (
                    <tr>
                      <td colSpan={3} className="px-6 py-4 text-center text-gray-500">
                        Henüz somun eklenmemiş
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
