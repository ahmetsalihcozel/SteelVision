type TaskedPart = {
  part: string;
  qty: string;
  profile: string;
  grade: string;
  length_mm: string;
  weight_kg: string;
  tasks?: string[];
};

type AssemblyData = {
  [assemblyName: string]: {
    qty: string;
    weight_kg: string;
    parts: TaskedPart[];
  };
};

export default function AssemblyDisplay({ data }: { data?: AssemblyData }) {
  if (!data || Object.keys(data).length === 0) {
    return <p className="text-gray-500">Henüz veri yüklenmedi.</p>;
  }

  return (
    <div className="p-4">
      {Object.entries(data).map(([assemblyName, assembly]) => (
        <div key={assemblyName} className="mb-6 p-4 border rounded shadow bg-gray-50">
          <h3 className="text-xl font-bold mb-2">Birleşim: {assemblyName}</h3>
          <p className="mb-2">Adet: {assembly.qty} | Ağırlık: {assembly.weight_kg} kg</p>

          {assembly.parts.map((part, idx) => (
            <div key={idx} className="p-3 bg-white rounded border mb-2">
              <p><strong>Adet:</strong> {part.qty}</p>
              <p><strong>Parça:</strong> {part.part}</p>
              <p><strong>Profil:</strong> {part.profile}</p>
              <p><strong>Boy:</strong> {part.length_mm} mm | <strong>Ağırlık:</strong> {part.weight_kg} kg</p>
              <div>
                <strong>Görevler:</strong>
                <ul className="list-disc ml-5">
                  {(part.tasks ?? []).map((task, i) => (
                    <li key={i}>{task}</li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
