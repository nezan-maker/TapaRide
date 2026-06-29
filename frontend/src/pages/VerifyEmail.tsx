import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { api, ApiError } from '../lib/api'
import BusSpinner from '../components/BusSpinner'
import Fa from '../components/Fa'

type Status = 'loading' | 'success' | 'error'

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState('Verifying your email...');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Invalid verification link. No token provided.');
      return;
    }

    api
      .get(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(() => {
        setStatus('success');
        setMessage('Your email has been verified successfully!');
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err instanceof ApiError ? err.message : 'Verification failed. The link may have expired.');
      });
  }, [token]);

  return (
    <div className="bg-mist min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="card p-8 text-center">
          {status === 'loading' && (
            <div className="flex flex-col items-center gap-4">
              <BusSpinner />
              <h1 className="text-xl font-bold text-ink-900">Verifying your email...</h1>
              <p className="text-sm text-ink-500">{message}</p>
            </div>
          )}

          {status === 'success' && (
            <>
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-emerald-600">
                <Fa name="check" className="h-7 w-7" />
              </span>
              <h1 className="mt-4 text-xl font-bold text-ink-900">Email Verified!</h1>
              <p className="mt-2 text-sm text-ink-500">{message}</p>
              <Link to="/login" className="btn-primary mt-6 inline-flex">
                Continue to Login <Fa name="arrow-right" className="ml-1 h-4 w-4" />
              </Link>
            </>
          )}

          {status === 'error' && (
            <>
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-flame-100 text-flame-600">
                <Fa name="alert-circle" className="h-7 w-7" />
              </span>
              <h1 className="mt-4 text-xl font-bold text-ink-900">Verification Failed</h1>
              <p className="mt-2 text-sm text-ink-500">{message}</p>
              <div className="mt-6 flex flex-col gap-3">
                <Link to="/login" className="btn-primary inline-flex justify-center">
                  Go to Login
                </Link>
                <Link to="/signup" className="btn-outline inline-flex justify-center">
                  Create New Account
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
