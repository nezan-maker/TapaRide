import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import BusSpinner from '../components/BusSpinner'
import Landing from './Landing'

export default function AuthenticatedRedirect() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <BusSpinner />
      </div>
    )
  }

  if (user) {
    return <Navigate to="/dashboard" replace />
  }

  return <Landing />
}
