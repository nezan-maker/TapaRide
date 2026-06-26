import { useState, useEffect, useCallback } from 'react'
import { cn, rwf } from '../../lib/utils'
import { api, ApiError } from '../../lib/api'
import Fa from '../../components/Fa';
import StripeTopupForm from '../../components/StripeTopupForm';

interface WalletStatus {
  id?: string
  status: 'UNINITIALIZED' | 'ACTIVE' | 'SUSPENDED' | string
  unlocked: boolean
  createdAt?: string
}

interface Transaction {
  id: string
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'PAYMENT' | 'REFUND' | string
  amount: number
  note: string | null
  createdAt: string
}

type DialogKind = null | 'unlock' | 'setup' | 'deposit' | 'withdraw' | 'change-password';

const TX_LABELS: Record<string, { label: string; sign: 'in' | 'out' }> = {
  DEPOSIT:     { label: 'Top-up',     sign: 'in' },
  TOPUP:       { label: 'Top-up',     sign: 'in' },
  REFUND:      { label: 'Refund',     sign: 'in' },
  WITHDRAWAL:  { label: 'Cashout',    sign: 'out' },
  PAYMENT:     { label: 'Payment',    sign: 'out' },
};

function txMeta(t: Transaction) {
  const meta = TX_LABELS[t.type] ?? { label: t.type, sign: 'out' as const };
  return { ...meta, signedAmount: (meta.sign === 'in' ? '+' : '-') + rwf(t.amount) };
}

/**
 * PaymentMethods — Apple-style wallet surface.
 *
 * Three concerns live here, in this order:
 *   1. Setup / unlock / status
 *   2. Balance + top-up + cashout
 *   3. Recent transactions
 *
 * API: every action calls the real backend (see backend/src/modules/wallets).
 * No mock data.
 */
export default function PaymentMethods() {
  const [wallet, setWallet] = useState<WalletStatus | null>(null)
  const [balance, setBalance] = useState<number | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [dialog, setDialog] = useState<DialogKind>(null)
  const [walletPassword, setWalletPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [amount, setAmount] = useState('')
  const [topupAmount, setTopupAmount] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)

  const isUninitialized = wallet?.status === 'UNINITIALIZED'
  const isActive = wallet?.status === 'ACTIVE'
  const isUnlocked = !!wallet?.unlocked
  const canTransact = isActive && isUnlocked

  const fetchWalletData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // GET /api/wallet returns the user's wallet status (no password needed).
      const status = await api.get('/api/wallet')
      setWallet(status)

      if (status.unlocked) {
        // Send the same password the user just unlocked with. We keep it
        // in state so the GET-then-balance roundtrip works without asking
        // the user to re-type their wallet password. (The previous version
        // sent an empty string, which silently failed — see audit §5.1.)
        const balanceRes = await api.post('/api/wallet/balance', {
          walletPassword: walletPassword || undefined,
        })
        if (balanceRes?.balance != null) setBalance(balanceRes.balance)

        const txRes = await api.get('/api/wallet/transactions')
        setTransactions(txRes.items || txRes.transactions || txRes || [])
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setWallet({ status: 'UNINITIALIZED', unlocked: false })
      } else {
        setError(err instanceof ApiError ? err.message : 'Failed to load wallet')
      }
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletPassword])

  useEffect(() => {
    fetchWalletData()
  }, [fetchWalletData])

  // ─── Action handlers ─────────────────────────────────────────────────────
  const closeDialog = () => {
    if (busy) return
    setDialog(null)
    setWalletPassword('')
    setNewPassword('')
    setAmount('')
    setTopupAmount(null)
    setError(null)
  }

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (walletPassword.length < 4) {
      setError('Wallet password must be at least 4 characters.')
      return
    }
    setBusy(true); setError(null)
    try {
      await api.post('/api/wallet/setup', { walletPassword })
      closeDialog()
      await fetchWalletData()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Setup failed')
    } finally {
      setBusy(false)
    }
  }

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!walletPassword) return
    setBusy(true); setError(null)
    try {
      await api.post('/api/wallet/unlock', { walletPassword })
      // Don't clear the password yet — we need it to fetch the balance.
      setDialog(null)
      await fetchWalletData()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unlock failed')
    } finally {
      setBusy(false)
    }
  }

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault()
    const n = Number(amount)
    if (!Number.isInteger(n) || n <= 0) {
      setError('Enter a positive whole number.')
      return
    }
    setTopupAmount(n)
    setError(null)
  }

  const handleTopupSuccess = async () => {
    closeDialog()
    await fetchWalletData()
  }

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault()
    const n = Number(amount)
    if (!Number.isInteger(n) || n <= 0) {
      setError('Enter a positive whole number.')
      return
    }
    setBusy(true); setError(null)
    try {
      await api.post('/api/wallet/withdraw', { amount: n, walletPassword: walletPassword || undefined })
      closeDialog()
      await fetchWalletData()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Cashout failed')
    } finally {
      setBusy(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (walletPassword.length < 1 || newPassword.length < 4) {
      setError('Current password required, new password must be 4+ characters.')
      return
    }
    setBusy(true); setError(null)
    try {
      await api.post('/api/wallet/change-password', {
        oldPassword: walletPassword,
        newPassword,
      })
      closeDialog()
      await fetchWalletData()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not change password')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-ink-900">Payment Methods</h1>
        <p className="text-ink-500">Manage your wallet, top-ups, and security.</p>
      </div>

      {error && !dialog && (
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
          {/* ─── Wallet hero card ─────────────────────────────────────── */}
          <section className="overflow-hidden rounded-3xl border border-ink-100/80 bg-gradient-to-br from-ink-900 via-ink-800 to-ink-700 p-7 text-white shadow-card sm:p-9">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">
                  <Fa name="wallet" className="h-3.5 w-3.5" /> Tapa Wallet
                </div>
                <div className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
                  {canTransact && balance != null ? rwf(balance) : '—'}
                </div>
                <div className="mt-2 flex items-center gap-2 text-sm text-white/60">
                  {isUninitialized && 'Not set up yet'}
                  {isActive && (isUnlocked ? 'Unlocked · ready to transact' : 'Locked · unlock to transact')}
                  {wallet?.status === 'SUSPENDED' && 'Suspended — contact support'}
                </div>
              </div>
              <div className="hidden sm:block">
                <Fa
                  name={isUnlocked ? 'unlock' : 'lock'}
                  className={cn('h-12 w-12', isUnlocked ? 'text-emerald-400' : 'text-amber-400')}
                />
              </div>
            </div>

            <div className="mt-7 flex flex-wrap gap-3">
              {isUninitialized && (
                <button
                  onClick={() => { setDialog('setup'); setError(null) }}
                  className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-ink-900 transition hover:bg-white/90"
                >
                  <Fa name="plus" className="mr-1.5 inline h-4 w-4" /> Set Up Wallet
                </button>
              )}
              {isActive && !isUnlocked && (
                <button
                  onClick={() => { setDialog('unlock'); setError(null) }}
                  className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-ink-900 transition hover:bg-white/90"
                >
                  <Fa name="unlock" className="mr-1.5 inline h-4 w-4" /> Unlock Wallet
                </button>
              )}
              {canTransact && (
                <>
                  <button
                    onClick={() => { setDialog('deposit'); setError(null) }}
                    className="rounded-xl bg-flame-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-flame-700"
                  >
                    <Fa name="arrow-down" className="mr-1.5 inline h-4 w-4" /> Top Up
                  </button>
                  <button
                    onClick={() => { setDialog('withdraw'); setError(null) }}
                    className="rounded-xl border border-white/25 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    <Fa name="arrow-up" className="mr-1.5 inline h-4 w-4" /> Cash Out
                  </button>
                </>
              )}
            </div>
          </section>

          {/* ─── Quick actions — Apple-style 3-up cards ────────────────── */}
          {isActive && (
            <section className="grid gap-4 md:grid-cols-3">
              <button
                onClick={() => { setDialog('deposit'); setError(null) }}
                disabled={!isUnlocked}
                className="group flex h-full flex-col rounded-2xl border border-ink-100/80 bg-white p-6 text-left shadow-soft transition hover:shadow-card disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-flame-600">Add money</span>
                  <Fa name="arrow-down" className="h-5 w-5 text-ink-900 transition group-hover:text-flame-600" />
                </div>
                <h3 className="mt-10 text-xl font-semibold tracking-tight text-ink-900">Top up wallet</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-500">
                  Move mobile-money funds into your Tapa wallet for instant ticket and parcel payments.
                </p>
                <span className="mt-auto pt-6 inline-flex items-center gap-1.5 text-sm font-medium text-flame-600">
                  Top up <Fa name="arrow-right" className="h-3.5 w-3.5" />
                </span>
              </button>

              <button
                onClick={() => { setDialog('withdraw'); setError(null) }}
                disabled={!isUnlocked}
                className="group flex h-full flex-col rounded-2xl border border-ink-100/80 bg-white p-6 text-left shadow-soft transition hover:shadow-card disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-flame-600">Move out</span>
                  <Fa name="arrow-up" className="h-5 w-5 text-ink-900 transition group-hover:text-flame-600" />
                </div>
                <h3 className="mt-10 text-xl font-semibold tracking-tight text-ink-900">Cash out</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-500">
                  Withdraw your wallet balance back to mobile money at any Tapa agent or station.
                </p>
                <span className="mt-auto pt-6 inline-flex items-center gap-1.5 text-sm font-medium text-flame-600">
                  Cash out <Fa name="arrow-right" className="h-3.5 w-3.5" />
                </span>
              </button>

              <button
                onClick={() => { setDialog('change-password'); setError(null) }}
                className="group flex h-full flex-col rounded-2xl border border-ink-100/80 bg-white p-6 text-left shadow-soft transition hover:shadow-card"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-flame-600">Security</span>
                  <Fa name="lock" className="h-5 w-5 text-ink-900 transition group-hover:text-flame-600" />
                </div>
                <h3 className="mt-10 text-xl font-semibold tracking-tight text-ink-900">Change password</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-500">
                  Rotate the password you use to unlock the wallet and authorize payments.
                </p>
                <span className="mt-auto pt-6 inline-flex items-center gap-1.5 text-sm font-medium text-flame-600">
                  Update <Fa name="arrow-right" className="h-3.5 w-3.5" />
                </span>
              </button>
            </section>
          )}

          {/* ─── Recent transactions ───────────────────────────────────── */}
          <section className="rounded-3xl border border-ink-100/80 bg-white p-6 shadow-soft sm:p-8">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold tracking-tight text-ink-900">Recent activity</h2>
              {transactions.length > 0 && (
                <span className="text-xs text-ink-400">{transactions.length} record{transactions.length === 1 ? '' : 's'}</span>
              )}
            </div>
            {transactions.length > 0 ? (
              <ul className="mt-5 divide-y divide-ink-50">
                {transactions.slice(0, 10).map((t) => {
                  const meta = txMeta(t);
                  return (
                    <li key={t.id} className="flex items-center justify-between py-3.5">
                      <div>
                        <div className="text-sm font-semibold text-ink-900">{meta.label}</div>
                        <div className="text-xs text-ink-400">
                          {t.note || '—'} · {new Date(t.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <span
                        className={cn(
                          'text-sm font-semibold tabular-nums',
                          meta.sign === 'in' ? 'text-emerald-600' : 'text-ink-900',
                        )}
                      >
                        {meta.signedAmount}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="mt-6 rounded-2xl border border-dashed border-ink-100 bg-mist/50 py-10 text-center text-sm text-ink-500">
                <Fa name="creditcard" className="mx-auto mb-2 h-8 w-8 text-ink-200" />
                {isUninitialized
                  ? 'Set up your wallet to start transacting.'
                  : isUnlocked
                  ? 'No activity yet — your first top-up will appear here.'
                  : 'Unlock your wallet to see your activity.'}
              </div>
            )}
          </section>
        </>
      )}

      {/* ─── Dialog (Apple-style centered modal sheet) ─────────────────────── */}
      {dialog && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-ink-950/40 p-4 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) closeDialog() }}
        >
          <form
            onSubmit={
              dialog === 'setup' ? handleSetup
              : dialog === 'unlock' ? handleUnlock
              : dialog === 'deposit' ? handleDeposit
              : dialog === 'withdraw' ? handleWithdraw
              : dialog === 'change-password' ? handleChangePassword
              : () => {}
            }
            className="w-full max-w-md overflow-hidden rounded-3xl border border-ink-100/80 bg-white p-7 shadow-glow"
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-flame-600">
                  {dialog === 'setup' && 'New wallet'}
                  {dialog === 'unlock' && 'Security'}
                  {dialog === 'deposit' && 'Add money'}
                  {dialog === 'withdraw' && 'Cash out'}
                  {dialog === 'change-password' && 'Security'}
                </span>
                <h3 className="mt-1.5 text-2xl font-semibold tracking-tight text-ink-900">
                  {dialog === 'setup' && 'Set up your wallet'}
                  {dialog === 'unlock' && 'Unlock your wallet'}
                  {dialog === 'deposit' && 'Top up wallet'}
                  {dialog === 'withdraw' && 'Cash out'}
                  {dialog === 'change-password' && 'Change wallet password'}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeDialog}
                aria-label="Close"
                className="grid h-9 w-9 place-items-center rounded-full bg-ink-50 text-ink-500 transition hover:bg-ink-100"
              >
                <Fa name="x" className="h-4 w-4" />
              </button>
            </div>

            {error && (
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-flame-50 px-4 py-3 text-sm text-flame-700">
                <Fa name="alert-circle" className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="mt-5 space-y-3">
              {dialog === 'setup' && (
                <Field
                  label="New wallet password"
                  type="password"
                  value={walletPassword}
                  onChange={setWalletPassword}
                  placeholder="At least 4 characters"
                  autoFocus
                />
              )}

              {dialog === 'unlock' && (
                <Field
                  label="Wallet password"
                  type="password"
                  value={walletPassword}
                  onChange={setWalletPassword}
                  placeholder="Enter your wallet password"
                  autoFocus
                />
              )}

              {dialog === 'deposit' && !topupAmount && (
                <Field
                  label="Amount (RWF)"
                  type="number"
                  value={amount}
                  onChange={setAmount}
                  placeholder="e.g. 5000"
                  min={1}
                  autoFocus
                />
              )}

              {dialog === 'deposit' && topupAmount != null && (
                <StripeTopupForm
                  amount={topupAmount}
                  onSuccess={handleTopupSuccess}
                  onCancel={() => setTopupAmount(null)}
                />
              )}

              {dialog === 'withdraw' && (
                <>
                  <Field
                    label="Amount (RWF)"
                    type="number"
                    value={amount}
                    onChange={setAmount}
                    placeholder="e.g. 5000"
                    min={1}
                    autoFocus
                  />
                  <p className="text-xs text-ink-400">
                    Withdrawals require your wallet password.
                  </p>
                  <Field
                    label="Wallet password"
                    type="password"
                    value={walletPassword}
                    onChange={setWalletPassword}
                    placeholder="Confirm wallet password"
                  />
                </>
              )}

              {dialog === 'change-password' && (
                <>
                  <Field
                    label="Current wallet password"
                    type="password"
                    value={walletPassword}
                    onChange={setWalletPassword}
                    placeholder="Current password"
                    autoFocus
                  />
                  <Field
                    label="New wallet password"
                    type="password"
                    value={newPassword}
                    onChange={setNewPassword}
                    placeholder="At least 4 characters"
                  />
                </>
              )}
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              {!(dialog === 'deposit' && topupAmount != null) && (
                <>
                  <button
                    type="button"
                    onClick={closeDialog}
                    disabled={busy}
                    className="rounded-xl px-4 py-2.5 text-sm font-semibold text-ink-500 transition hover:bg-ink-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={busy}
                    className="rounded-xl bg-ink-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-ink-800 disabled:opacity-50"
                  >
                    {busy
                      ? 'Working…'
                      : dialog === 'setup' ? 'Create wallet'
                      : dialog === 'unlock' ? 'Unlock'
                      : dialog === 'deposit' ? 'Continue'
                      : dialog === 'withdraw' ? 'Cash out'
                      : 'Update password'}
                  </button>
                </>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

interface FieldProps {
  label: string;
  type: 'password' | 'number' | 'text';
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  min?: number;
  autoFocus?: boolean;
}

function Field({ label, type, value, onChange, placeholder, min, autoFocus }: FieldProps) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        min={min}
        autoFocus={autoFocus}
        className="input"
      />
    </label>
  );
}
