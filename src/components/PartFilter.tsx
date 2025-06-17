import React from 'react';

interface PartFilterProps {
  onFilterChange: (filters: {
    name: string;
    profile: string;
    length: string;
    qty: string;
    weight: string;
  }) => void;
}

export default function PartFilter({ onFilterChange }: PartFilterProps) {
  const [filters, setFilters] = React.useState({
    name: '',
    profile: '',
    length: '',
    qty: '',
    weight: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const newFilters = { ...filters, [name]: value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Parça Adı
        </label>
        <input
          type="text"
          name="name"
          value={filters.name}
          onChange={handleChange}
          placeholder="Parça adına göre filtrele"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Profil
        </label>
        <input
          type="text"
          name="profile"
          value={filters.profile}
          onChange={handleChange}
          placeholder="Profile göre filtrele"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Adet
        </label>
        <input
          type="text"
          name="qty"
          value={filters.qty}
          onChange={handleChange}
          placeholder="Adete göre filtrele"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Uzunluk (mm)
        </label>
        <input
          type="text"
          name="length"
          value={filters.length}
          onChange={handleChange}
          placeholder="Uzunluğa göre filtrele"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Ağırlık (kg)
        </label>
        <input
          type="text"
          name="weight"
          value={filters.weight}
          onChange={handleChange}
          placeholder="Ağırlığa göre filtrele"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
    </div>
  );
} 