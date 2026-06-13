import { cn } from '../lib/utils'
import Fa from './Fa';

type Amenity = 'WiFi' | 'AC' | 'Charging' | 'Restroom'

const map: Record<Amenity, { icon: string; label: string }> = {
  WiFi: { icon: 'wifi', label: 'WiFi on Board' },
  AC: { icon: 'snowflake', label: 'Air Conditioning' },
  Charging: { icon: 'batterycharging', label: 'USB Charging' },
  Restroom: { icon: 'toilet', label: 'Onboard Restroom' },
}

const all: Amenity[] = ['WiFi', 'AC', 'Charging', 'Restroom']

export default function AmenityIcons({ amenities }: { amenities: Amenity[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      {all.map((a) => {
        const active = amenities.includes(a)
        const { icon: iconName, label } = map[a]
        return (
          <span
            key={a}
            title={label}
            className={cn(
              'inline-flex items-center gap-1.5 text-xs',
              active ? 'text-ink-700' : 'text-ink-200',
            )}
          >
            <Fa name={iconName} className="h-3.5 w-3.5" /> {label}
          </span>
        )
      })}
    </div>
  )
}
