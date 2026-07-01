"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");

    if (savedTheme === "dark") {
      document.documentElement.classList.add("dark");
      setDarkMode(true);
    }
  }, []);

  function toggleTheme() {
    if (darkMode) {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    } else {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    }

    setDarkMode(!darkMode);
  }

  return (
   <button
  onClick={toggleTheme}
  className="fixed top-5 right-5 w-4 h-4 rounded-full bg-[#00572D] text-white shadow-lg z-50 flex items-center justify-center text-xs"
>
  {darkMode ? "☀️" : "🌙"}
</button>
  );
}