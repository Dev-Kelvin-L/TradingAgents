'use client'
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="p-6 flex flex-col items-center justify-center min-h-[400px]">
      <div className="text-[#ff4444] font-mono text-sm uppercase tracking-widest mb-2">Error</div>
      <div className="text-white text-lg mb-4">{error.message}</div>
      <button onClick={reset} className="px-4 py-2 bg-[#1a1a1a] border border-[#333] rounded text-sm text-gray-400 hover:text-white transition-colors">
        Try Again
      </button>
    </div>
  )
}
