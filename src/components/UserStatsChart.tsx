"use client";

import { useEffect, useState } from 'react';
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
import { Project, TaskStatus } from '@/types/types';
import { db } from '@/api/firebase';
import { collection, getDocs } from 'firebase/firestore';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface UserStatsChartProps {
  project: Project;
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export default function UserStatsChart({ project }: UserStatsChartProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const usersCollection = collection(db, 'users');
        const usersSnapshot = await getDocs(usersCollection);
        const usersList = usersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as User));
        setUsers(usersList);
      } catch (error) {
        console.error('Error fetching users:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const calculateUserStats = () => {
    const userStats = new Map<string, number>();

    // Önce tüm kullanıcıları 0 görev ile başlat
    users.forEach(user => {
      userStats.set(`${user.firstName} ${user.lastName}`, 0);
    });

    // Tamamlanan görevleri say
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
  };

  const userStats = calculateUserStats();

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6 mb-5">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Kullanıcı İstatistikleri</h2>
        <div className="h-[400px] flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 mb-5">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Kullanıcı İstatistikleri</h2>
      <div className="h-[400px]">
        <Bar
          data={{
            labels: userStats.map(([name]) => name),
            datasets: [
              {
                label: 'Tamamlanan Görev Sayısı',
                data: userStats.map(([_, count]) => count),
                backgroundColor: [
                  'rgba(59, 130, 246, 0.8)',  // blue-500
                  'rgba(16, 185, 129, 0.8)',  // emerald-500
                  'rgba(245, 158, 11, 0.8)',  // amber-500
                  'rgba(239, 68, 68, 0.8)',   // red-500
                  'rgba(139, 92, 246, 0.8)',  // violet-500
                  'rgba(14, 165, 233, 0.8)',  // sky-500
                  'rgba(236, 72, 153, 0.8)',  // pink-500
                  'rgba(234, 179, 8, 0.8)',   // yellow-500
                ],
                borderColor: [
                  'rgb(59, 130, 246)',    // blue-500
                  'rgb(16, 185, 129)',    // emerald-500
                  'rgb(245, 158, 11)',    // amber-500
                  'rgb(239, 68, 68)',     // red-500
                  'rgb(139, 92, 246)',    // violet-500
                  'rgb(14, 165, 233)',    // sky-500
                  'rgb(236, 72, 153)',    // pink-500
                  'rgb(234, 179, 8)',     // yellow-500
                ],
                borderWidth: 1,
              },
            ],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'top' as const,
                labels: {
                  font: {
                    size: 14,
                    family: "'Inter', sans-serif",
                  },
                },
              },
              title: {
                display: false,
              },
              tooltip: {
                callbacks: {
                  label: function(context) {
                    const value = context.raw as number;
                    return `Tamamlanan Görev: ${value}`;
                  }
                }
              }
            },
            scales: {
              y: {
                beginAtZero: true,
                ticks: {
                  stepSize: 1,
                  font: {
                    size: 12,
                    family: "'Inter', sans-serif",
                  },
                },
                grid: {
                  color: 'rgba(0, 0, 0, 0.1)',
                },
              },
              x: {
                ticks: {
                  font: {
                    size: 12,
                    family: "'Inter', sans-serif",
                  },
                },
                grid: {
                  display: false,
                },
              },
            },
          }}
        />
      </div>
    </div>
  );
} 