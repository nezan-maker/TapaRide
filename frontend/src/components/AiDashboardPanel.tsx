import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import Fa from './Fa';

/**
 * Role-specific AI quick prompts and description.
 * Each role gets different suggested questions that match their capabilities.
 */
const AI_CONTEXT: Record<string, { title: string; subtitle: string; prompts: { icon: string; text: string; to?: string }[] }> = {
  CLIENT: {
    title: 'Ask about your trips & parcels',
    subtitle: 'Find routes, track parcels, check fees',
    prompts: [
      { icon: 'search', text: 'Find buses Kigali to Huye tomorrow' },
      { icon: 'package', text: 'How much to send a 3kg parcel?' },
      { icon: 'circle-question', text: 'How does the claim code work?' },
    ],
  },
  DRIVER: {
    title: 'Your trip assignments',
    subtitle: 'Passenger lists, next stops, route info',
    prompts: [
      { icon: 'route', text: 'Who boards at the next stop?' },
      { icon: 'users', text: 'How many passengers today?' },
      { icon: 'map-pin', text: 'Where is my next pickup?' },
    ],
  },
  MANAGER: {
    title: 'Operations at a glance',
    subtitle: 'Underbooked journeys, stale parcels, claims',
    prompts: [
      { icon: 'alert-circle', text: 'Which journeys are underbooked this week?' },
      { icon: 'package', text: 'Any parcels stuck in CONFIRMED?' },
      { icon: 'star', text: 'This week\'s revenue summary?' },
    ],
  },
  OWNER: {
    title: 'Business overview',
    subtitle: 'Revenue, agency performance, payouts',
    prompts: [
      { icon: 'star', text: 'Which journeys had the most bookings?' },
      { icon: 'wallet', text: 'Pending payouts this month?' },
      { icon: 'users', text: 'Top sending clients?' },
    ],
  },
};

/**
 * Inline AI assistant panel for the role-specific dashboard.
 * Shows role-aware quick prompts that open the floating assistant
 * or navigate to the full /support chat.
 */
export default function AiDashboardPanel() {
  const { user } = useAuth();

  const context = AI_CONTEXT[user?.role || 'CLIENT'];

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-ink-100 bg-gradient-to-r from-ink-900 to-ink-700 px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-flame-600">
            <Fa name="robot" className="h-3.5 w-3.5 text-white" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">{context.title}</div>
            <div className="text-[11px] text-ink-400">Tapa Assist · AI</div>
          </div>
        </div>
        <Link
          to="/support"
          className="rounded-lg px-2.5 py-1 text-[11px] font-medium text-white/80 transition hover:bg-ink-800 hover:text-white"
        >
          Full chat →
        </Link>
      </div>

      <div className="p-4">
        <p className="mb-3 text-xs text-ink-500">{context.subtitle}</p>
        <div className="space-y-2">
          {context.prompts.map((p) => (
            <Link
              key={p.text}
              to={p.to || '/support'}
              className="flex w-full items-center gap-2.5 rounded-xl border border-ink-100 px-3.5 py-2.5 text-left text-sm text-ink-700 transition hover:border-flame-200 hover:bg-flame-50 hover:text-flame-700"
            >
              <Fa name={p.icon} className="h-4 w-4 shrink-0 text-flame-600" />
              <span className="text-sm">{p.text}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
