"use client";
import { useEffect, useState } from "react";

export default function Home() {
  const [expenses, setExpenses] = useState([]);

  useEffect(() => {
    fetch("/api/getExpenses")
      .then((res) => res.json())
      .then((data) => setExpenses(data))
      .catch((err) => console.error("Error fetching:", err));
  }, []);

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-4">ניהול הוצאות הבית</h1>
      <div className="bg-white shadow rounded-lg p-4">
        {expenses.length === 0 ? (
          <p>אין נתונים להצגה או שטוען...</p>
        ) : (
          <ul className="divide-y">
            {expenses.map((exp: any) => (
              <li key={exp.id} className="py-2">
                {exp.description} - {exp.amount}₪
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}