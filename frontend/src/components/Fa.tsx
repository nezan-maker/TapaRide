import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { fas } from '@fortawesome/free-solid-svg-icons';
import { far } from '@fortawesome/free-regular-svg-icons';
import { fab } from '@fortawesome/free-brands-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

// Build a flat lookup map from all three style bundles
const iconLookup: Record<string, IconDefinition> = {};

for (const icon of Object.values(fas)) {
  const name = (icon as any).iconName || (icon as any).icon?.[1];
  if (name) iconLookup[name.toLowerCase()] = icon;
}
for (const icon of Object.values(far)) {
  const name = (icon as any).iconName || (icon as any).icon?.[1];
  if (name) iconLookup[name.toLowerCase()] = icon;
}
for (const icon of Object.values(fab)) {
  const name = (icon as any).iconName || (icon as any).icon?.[1];
  if (name) iconLookup[name.toLowerCase()] = icon;
}

interface FaProps {
  name: string;
  className?: string;
  onClick?: () => void;
}

export default function Fa({ name, className, onClick }: FaProps) {
  const normalized = name.toLowerCase().replace(/-/g, '');
  const icon = iconLookup[normalized];
  
  if (!icon) {
    console.warn(`Fa: icon "${name}" not found`);
    return <span className={className} onClick={onClick}>?</span>;
  }
  
  return <FontAwesomeIcon icon={icon} className={className} onClick={onClick} />;
}
