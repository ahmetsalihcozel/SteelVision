import { ProcessTime } from "@/types/types";

export const calculateManDays = (processTime: ProcessTime): number => {
  if (!processTime?.statusChanges?.length) return 0;

  let totalManDays = 0;
  let currentWorkerCount = 0;
  let lastDate: Date | null = null;


  const sortedChanges = [...processTime.statusChanges].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  for (const change of sortedChanges) {
    const currentDate = new Date(change.date);


    if (lastDate && currentWorkerCount > 0) {
      const daysDiff = Math.ceil(
        (currentDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      totalManDays += daysDiff * currentWorkerCount;
    }


    if (change.type === 'start' || change.type === 'continue') {
      currentWorkerCount = change.workerCount || 0;
    } else if (change.type === 'suspend' || change.type === 'finish') {
      currentWorkerCount = 0;
    }

    lastDate = currentDate;
  }


  if (lastDate && currentWorkerCount > 0) {
    const today = new Date();
    const daysDiff = Math.ceil(
      (today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    totalManDays += daysDiff * currentWorkerCount;
  }

  return totalManDays;
}; 