import { useState, useEffect } from 'react'
import { rwf } from '../../lib/utils'
import { api, ApiError } from '../../lib/api'
import Fa from '../../components/Fa';

interface WalletStatus {
  id?: string
  status: string
  unlocked: boolean
  createdAt?: string
}

interface Transaction {
  id: string
  type: string
  amount: number
  note: string | null
  createdAt: string
}

export default function PaymentMethods() {
  const [wallet, setWallet] = useState<WalletStatus | null>(null)
  const [balance, setBalance] = useState<number | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [walletPassword, setWalletPassword] = useState('')
  const [showUnlock, setShowUnlock] = useState(false)
  const [unlocking, setUnlocking] = useState(false)

  useEffect(() => {
    fetchWalletData()
  }, [])

  const fetchWalletData = async () => {
    setLoading(true)
    setError(null)
    try {
      // Get wallet status (no password needed)
      const statusData = await api.get('/api/wallet')
      setWallet(statusData)

      // If wallet is unlocked, fetch balance and transactions
      if (statusData.unlocked) {
        try {
          const [balanceData, txData] = await Promise.all([
            api.post('/api/wallet/balance', { walletPassword: '' }),
            api.get('/api/wallet/transactions'),
          ])
          if (balanceData?.balance != null) setBalance(balanceData.balance)
          setTransactions(txData.items || txData.transactions || txData || [])
        } catch {
          // Balance retrieval might fail if not unlocked — handled
        }
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        // Wallet not set up yet — normal state
        setWallet({ status: 'UNINITIALIZED', unlocked: false })
      } else {
        setError(err instanceof ApiError ? err.message : 'Failed to load wallet')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!walletPassword) return
    setUnlocking(true)
    setError(null)
    try {
      await api.post('/api/wallet/unlock', { walletPassword })
      setShowUnlock(false)
      setWalletPassword('')
      fetchWalletData()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to unlock wallet')
    } finally {
      setUnlocking(false)
    }
  }

  const isActive = wallet?.status === 'ACTIVE'

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold text-ink-900">Payment Methods</h1>
        <p className="text-ink-500">Manage your wallet and payment preferences.</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-flame-50 px-4 py-3 text-sm text-flame-700">
          <Fa name="alert-circle" className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-ink-100 border-t-flame-600" />
        </div>
      ) : (
        <>
          {/* Tapa Wallet */}
          <div className="card overflow-hidden">
            <div className="bg-gradient-to-r from-ink-900 to-ink-700 p-6 text-white">
              <div className="flex items-center gap-2 text-white/60 text-xs font-semibold uppercase tracking-wider mb-1">
                <Fa name="wallet" className="h-4 w-4" /> Tapa Wallet
              </div>
              <div className="text-3xl font-extrabold">
                {isActive && balance != null ? rwf(balance) : '—'}
              </div>
              <div className="mt-1 flex items-center gap-2 text-white/60 text-xs">
                <span>{isActive ? 'Active' : wallet?.status === 'UNINITIALIZED' ? 'Not set up' : wallet?.status || 'Unknown'}</span>
                {isActive && (
                  <span className="flex items-center gap-1">
                    · {wallet?.unlocked ? (
                      <><Fa name="unlock" className="h-3 w-3 text-emerald-400" /> Unlocked</>
                    ) : (
                      <><Fa name="lock" className="h-3 w-3 text-amber-400" /> Locked</>
                    )}
                  </span>
                )}
              </div>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-ink-600">
                Tapa uses a digital wallet system for all payments. Top up your wallet via mobile money (MTN / Airtel) at any Tapa agent or station.
              </p>
              <div className="flex flex-wrap gap-3">
                {!isActive && (
                  <button className="btn-primary flex-1 py-2.5 text-sm">Set Up Wallet</button>
                )}
                {isActive && !wallet?.unlocked && (
                  <button
                    onClick={() => setShowUnlock(true)}
                    className="btn-primary flex-1 py-2.5 text-sm"
                  >
                    <Fa name="unlock" className="h-4 w-4" /> Unlock Wallet
                  </button>
                )}
                {isActive && wallet?.unlocked && (
                  <button className="btn-outline flex-1 py-2.5 text-sm">Change Password</button>
                )}
              </div>

              {showUnlock && (
                <form onSubmit={handleUnlock} className="flex gap-2 pt-2">
                  <input
                    type="password"
                    className="input flex-1 py-2 text-sm"
                    placeholder="Enter wallet password"
                    value={walletPassword}
                    onChange={(e) => setWalletPassword(e.target.value)}
                    disabled={unlocking}
                  />
                  <button
                    type="submit"
                    disabled={unlocking || !walletPassword}
                    className="btn-primary py-2 text-sm"
                  >
                    {unlocking ? '...' : 'Unlock'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowUnlock(false)}
                    className="btn-outline py-2 text-sm"
                  >
                    Cancel
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="card p-6">
            <h2 className="font-bold text-ink-900 mb-4">Recent Transactions</h2>
            {transactions.length > 0 ? (
              <div className="divide-y divide-ink-50">
                {transactions.slice(0, 10).map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between py-3">
                    <div>
                      <div className="font-semibold text-ink-900 text-sm">
                        {tx.type === 'DEPOSIT' ? 'Deposit' : tx.type === 'WITHDRAWAL' ? 'Withdrawal' : tx.type === 'PAYMENT' ? 'Payment' : tx.type === 'REFUND' ? 'Refund' : tx.type}
                      </div>
                      <div className="text-xs text-ink-400">
                        {tx.note || 'No description'} · {new Date(tx.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <span className={`font-semibold text-sm ${tx.type === 'DEPOSIT' || tx.type === 'REFUND' ? 'text-emerald-600' : 'text-ink-900'}`}>
                      {tx.type === 'DEPOSIT' || tx.type === 'REFUND' ? '+' : '-'}{rwf(tx.amount)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-ink-400 text-sm">
                <Fa name="creditcard" className="mx-auto h-8 w-8 text-ink-200 mb-2" />
                {isActive ? 'No transactions yet.' : 'Set up your wallet to start transacting.'}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
