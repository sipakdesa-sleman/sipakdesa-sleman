import React from 'react';
import { RefreshCw, X } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    this.setState({ error, info });
    console.error('Uncaught error in app:', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const { error, info } = this.state;

    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
        <div className="max-w-3xl w-full bg-white border border-red-100 rounded-xl p-6 shadow">
          <h2 className="text-lg font-semibold text-red-700 mb-2">Terjadi kesalahan pada aplikasi</h2>
          <p className="text-sm text-gray-700 mb-4">Halaman gagal dimuat karena error runtime. Silakan lihat detail di bawah atau buka DevTools (Console) untuk rincian.</p>
          <div className="bg-gray-50 border border-red-50 rounded p-3 text-xs text-red-800 overflow-auto max-h-60">
            <pre className="whitespace-pre-wrap">{String(error && (error.message || error))}</pre>
            {info?.componentStack && (
              <details className="mt-3 text-xs text-gray-600">
                <summary>Stack trace</summary>
                <pre className="whitespace-pre-wrap mt-2">{info.componentStack}</pre>
              </details>
            )}
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={() => window.location.reload()} className="px-3 py-2 bg-red-600 text-white rounded inline-flex items-center gap-2">
              <RefreshCw size={16} /> Muat Ulang
            </button>
            <button onClick={() => { this.setState({ hasError: false, error: null, info: null }); }} className="px-3 py-2 border rounded inline-flex items-center justify-center" aria-label="close">
              <X size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }
}
