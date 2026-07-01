"use client";

import Link from "next/link";

type PharmacyCardProps = {
  id: string;
  name: string;
  city: string;
  address: string;
  phone: string;
  logoUrl?: string | null;
  isOpen?: boolean;
};

export default function PharmacyCard({
  id,
  name,
  city,
  address,
  phone,
  logoUrl,
  isOpen,
}: PharmacyCardProps) {
  return (
    <div className="bg-white rounded-3xl shadow-xl overflow-hidden">

      <div className="p-6">

        <div className="flex items-center gap-4">

          <img
            src={logoUrl || "/pharmacie.png"}
            alt={name}
            className="w-20 h-20 rounded-full object-cover border"
          />

          <div>

            <h2 className="text-xl font-bold text-black">
              {name}
            </h2>

            <p className="text-gray-600">
              📍 {city}
            </p>

          </div>

        </div>

        <div className="mt-4 space-y-2 text-gray-700">

          <p>
            📌 {address}
          </p>

          <p>
            📞 {phone}
          </p>

          <p>
            {isOpen ? "🟢 Ouverte" : "🔴 Fermée"}
          </p>

        </div>

        <Link
          href={`/dashboard/pharmacy/${id}`}
          className="block mt-5 text-center bg-[#00572D] text-white p-3 rounded-xl font-bold"
        >
          Voir la pharmacie
        </Link>

      </div>

    </div>
  );
}