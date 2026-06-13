import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { fas } from '@fortawesome/free-solid-svg-icons';
import { far } from '@fortawesome/free-regular-svg-icons';
import { fab } from '@fortawesome/free-brands-svg-icons';

// Helper to find icon by name from the imported style bundles
function findIcon(name: string) {
  const normalized = name.toLowerCase();
  
  // Search in solid icons
  if (fas[normalized]) return fas[normalized];
  
  // Search in regular icons
  if (far[normalized]) return far[normalized];
  
  // Search in brand icons
  if (fab[normalized]) return fab[normalized];
  
  // Try with 'fa-' prefix
  const withPrefix = 'fa-' + normalized;
  if (fas[withPrefix]) return fas[withPrefix];
  if (far[withPrefix]) return far[withPrefix];
  if (fab[withPrefix]) return fab[withPrefix];
  
  return null;
}

interface FaProps {
  name: string;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}

export default function Fa({ name, className = '', style, onClick }: FaProps) {
  const icon = findIcon(name);
  
  if (!icon) {
    // Fallback: try to render using the CSS class approach
    const normalized = name.toLowerCase();
    const isSpin = normalized === 'loader2';
    const prefix = normalized === 'apple' ? 'fab' : normalized === 'copy' ? 'far' : 'fas';
    return (
      <i
        className={`${prefix} fa-${normalized} ${isSpin ? 'fa-spin' : ''} ${className}`}
        style={style}
        onClick={onClick}
      />
    );
  }
  
  return (
    <FontAwesomeIcon
      icon={icon}
      className={className}
      style={style as any}
      onClick={onClick}
    />
  );
}
