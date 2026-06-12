import React, { useEffect, useState } from 'react';
import api from '@/api/client';

export default function AuditLogPage() {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    api.get('/admin/audit-logs').then(res => setLogs(res.data));
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Журнал безопасности</h1>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        {logs.map((log: any) => (
          <div key={log.id} className="p-4 border-b border-slate-100 flex justify-between items-center hover:bg-slate-50">
            <div>
              <span className="font-mono text-xs bg-slate-100 p-1 rounded">{log.method}</span>
              <span className="ml-3 font-medium text-slate-700">{log.path}</span>
              <p className="text-xs text-slate-400 mt-1">Пользователь: {log.user_email}</p>
            </div>
            <div className="text-right text-xs text-slate-500">
              {new Date(log.created_at).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

