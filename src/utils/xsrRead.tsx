import { Part } from "@/types/types";

const readXSRFile = async (file: File): Promise<{ parts: Part[], totalWeight: number }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n');
        
        // Total değerini bul
        const totalLine = lines.find(line => line.includes('Total:'));
        const totalWeight = totalLine ? parseFloat(totalLine.split('Total:')[1].trim()) : 0;
        
        // Başlık satırını atla ve boş satırları filtrele
        const dataLines = lines
          .slice(1) // İlk satırı (başlık) atla
          .filter(line => line.trim() !== ''); // Boş satırları filtrele

        const parts: Part[] = dataLines.map((line, index) => {
          const [part, profile, grade, length_mm, qty, weight_kg] = line
            .split('\t')
            .map(item => item.trim());

          // Eğer satır başlık satırı ise veya gerekli alanlar eksikse atla
          if (part === 'Assembly' || !part || !profile || !grade) {
            return null;
          }

          // Toplam ağırlığı hesapla
          const weight = parseFloat(weight_kg) || 0;
          const quantity = parseInt(qty) || 0;

          return {
            part,
            profile,
            grade,
            length_mm,
            qty,
            weight_kg,
            assemblyInstances: {},
            assemblyTasks: {}
          } as Part;
        }).filter((part): part is Part => part !== null); // null değerleri filtrele

        resolve({ parts, totalWeight });
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error('Dosya okuma hatası'));
    reader.readAsText(file);
  });
};

export { readXSRFile }; 