import React, { useState } from 'react';
import api from '@/api/client';

export default function ContingentPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    try {
      // Замени {id} на реальный ID организации пользователя или убери, 
      // если бэкенд определяет ID сам по токену
      await api.post('/organisations/my/contingent', data);
      setMessage({ type: 'success', text: 'Данные успешно сохранены!' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Ошибка при сохранении данных.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-2 text-slate-800">Контингент обучающихся</h1>
      <p className="text-slate-500 mb-8">Введите актуальные данные по количеству студентов вашей организации.</p>

      <form onSubmit={handleSubmit} className="space-y-6 bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Бакалавриат (всего)</label>
            <input name="bachelor_total" type="number" required className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Грант (государственный)</label>
            <input name="grant_total" type="number" required className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Магистратура</label>
            <input name="master_total" type="number" className="w-full p-2 border rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Докторантура</label>
            <input name="phd_total" type="number" className="w-full p-2 border rounded-lg" />
          </div>
        </div>

        {message.text && (
          <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {message.text}
          </div>
        )}

        <button 
          type="submit" 
          disabled={loading}
          className="w-full md:w-auto px-8 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:bg-slate-400"
        >
          {loading ? 'Отправка...' : 'Сохранить данные'}
        </button>
      </form>
    </div>
  );
}

