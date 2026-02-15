import type { ReactNode } from 'react';

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold text-center text-gray-900 mb-8">Trello Clone</h1>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">{children}</div>
      </div>
    </div>
  );
}
