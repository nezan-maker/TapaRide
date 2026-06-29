export default function AuthSpinner({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center justify-center gap-2">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent opacity-80" />
      {label && <span className="text-sm">{label}</span>}
    </span>
  )
}
