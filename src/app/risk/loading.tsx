export default function Loading() {
  return (
    <div className="p-6 space-y-4 animate-pulse">
      <div className="h-8 bg-[#1a1a1a] rounded w-64" />
      <div className="h-32 bg-[#1a1a1a] rounded" />
      <div className="grid grid-cols-2 gap-4">
        <div className="h-40 bg-[#1a1a1a] rounded" />
        <div className="h-40 bg-[#1a1a1a] rounded" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="h-28 bg-[#1a1a1a] rounded" />
        <div className="h-28 bg-[#1a1a1a] rounded" />
        <div className="h-28 bg-[#1a1a1a] rounded" />
      </div>
    </div>
  )
}
