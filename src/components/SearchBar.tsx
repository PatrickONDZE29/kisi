"use client";

type SearchBarProps = {
  value: string;
  onChange: (value: string) => void;
};

export default function SearchBar({
  value,
  onChange,
}: SearchBarProps) {
  return (
    <div className="bg-white rounded-3xl p-5 shadow-xl">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Rechercher un médicament..."
        className="w-full p-4 border-2 border-gray-200 rounded-xl text-black focus:outline-none focus:border-[#00572D]"
      />
    </div>
  );
}