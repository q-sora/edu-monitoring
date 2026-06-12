import React, { useEffect, useState } from 'react';
import api from '@/api/client';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/users').then(res => {
      setUsers(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-10">Загрузка данных...</div>;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6 text-slate-800">Управление пользователями</h1>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="p-4 font-semibold text-slate-600">Email</th>
              <th className="p-4 font-semibold text-slate-600">Роль</th>
              <th className="p-4 font-semibold text-slate-600">Статус</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u: any) => (
              <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="p-4 text-slate-700">{u.email}</td>
                <td className="p-4"><span className="px-2 py-1 bg-blue-50 text-blue-600 rounded text-xs uppercase font-bold">{u.role}</span></td>
                <td className="p-4">{u.is_active ? '✅ Активен' : '🚫 Заблокирован'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
