import React, { useState } from 'react';
import api from '@/api/client';

export default function SciencePage() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await api.post('/organisations/my/science-activity', data);
      setStatus('success');
    } catch {
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Научная деятельность</h1>
      <form onSubmit={handleSubmit} className="space-y-6 bg-white p-8 rounded-2xl shadow-sm border">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium mb-1">Количество публикаций (Scopus/WoS)</label>
            <input name="publications_count" type="number" required className="w-full p-2 border rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Цитируемость (индекс Хирша организации)</label>
            <input name="h_index" type="number" required className="w-full p-2 border rounded-lg" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Сумма грантового финансирования (тг)</label>
            <input name="grant_funding_amount" type="number" required className="w-full p-2 border rounded-lg" />
          </div>
        </div>
        {status === 'success' && <p className="text-green-600">Данные по науке обновлены!</p>}
        <button type="submit" disabled={loading} className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
          {loading ? 'Загрузка...' : 'Обновить показатели'}
        </button>
      </form>
    </div>
  );
}
