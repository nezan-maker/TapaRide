import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import Landing from './Landing'

export default function AuthenticatedRedirect() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink-200 border-t-ink-900" />
      </div>
    )
  }

  if (user) {
    return <Navigate to="/dashboard" replace />
  }

  return <Landing />
}
