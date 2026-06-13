import React from 'react';

const iconMap: Record<string, string> = {
  ac: 'fa-snowflake',
  alertcircle: 'fa-circle-exclamation',
  alerttriangle: 'fa-triangle-exclamation',
  apple: 'fa-brands fa-apple',
  arrowdown: 'fa-arrow-down',
  arrowleft: 'fa-arrow-left',
  arrowleftright: 'fa-arrows-left-right',
  arrowright: 'fa-arrow-right',
  arrowup: 'fa-arrow-up',
  batterycharging: 'fa-battery-bolt',
  bell: 'fa-bell',
  bellring: 'fa-bell',
  bus: 'fa-bus',
  busbooking: 'fa-bus',
  busfront: 'fa-bus-simple',
  calendar: 'fa-calendar',
  camera: 'fa-camera',
  charging: 'fa-battery-bolt',
  check: 'fa-check',
  checkcircle: 'fa-circle-check',
  checkcircle2: 'fa-regular fa-circle-check',
  chevrondown: 'fa-chevron-down',
  chevronleft: 'fa-chevron-left',
  chevronright: 'fa-chevron-right',
  circle: 'fa-regular fa-circle',
  circlecheck: 'fa-regular fa-circle-check',
  circlexmark: 'fa-circle-xmark',
  clock: 'fa-clock',
  clouduploadalt: 'fa-cloud-arrow-up',
  copy: 'fa-regular fa-copy',
  creditcard: 'fa-regular fa-credit-card',
  dollarsign: 'fa-dollar-sign',
  download: 'fa-download',
  eye: 'fa-eye',
  eyeoff: 'fa-eye-slash',
  filelines: 'fa-file-lines',
  fingerprint: 'fa-fingerprint',
  globe: 'fa-globe',
  gps: 'fa-location-crosshairs',
  home: 'fa-house',
  info: 'fa-info-circle',
  layoutdashboard: 'fa-gauge-high',
  lifering: 'fa-life-ring',
  lightbulb: 'fa-lightbulb',
  loader2: 'fa-spinner',
  lock: 'fa-lock',
  logout: 'fa-right-from-bracket',
  mail: 'fa-envelope',
  mappin: 'fa-location-dot',
  megaphone: 'fa-bullhorn',
  menu: 'fa-bars',
  message: 'fa-message',
  minus: 'fa-minus',
  mobile: 'fa-mobile-screen-button',
  moon: 'fa-moon',
  navigation: 'fa-location-arrow',
  package: 'fa-box',
  passenger: 'fa-user',
  passengersafe: 'fa-user-check',
  pencil: 'fa-pencil',
  phone: 'fa-phone',
  play: 'fa-play',
  plus: 'fa-plus',
  qrcode: 'fa-qrcode',
  refreshcw: 'fa-rotate',
  restroom: 'fa-toilet',
  rotateccw: 'fa-arrow-rotate-left',
  search: 'fa-magnifying-glass',
  settings: 'fa-gear',
  settingsicon: 'fa-gear',
  shield: 'fa-shield',
  shieldcheck: 'fa-shield-halved',
  signoutalt: 'fa-right-from-bracket',
  smartphone: 'fa-mobile-screen-button',
  slidershorizontal: 'fa-sliders',
  snowflake: 'fa-snowflake',
  star: 'fa-star',
  staro: 'fa-regular fa-star',
  stickynote: 'fa-regular fa-note-sticky',
  stopeta: 'fa-clock',
  stopreached: 'fa-flag-checkered',
  sun: 'fa-sun',
  sunset: 'fa-cloud-sun',
  tag: 'fa-tag',
  ticket: 'fa-ticket',
  toilet: 'fa-toilet',
  trash2: 'fa-trash',
  truck: 'fa-truck',
  unlock: 'fa-unlock',
  upload: 'fa-upload',
  user: 'fa-user',
  userplus: 'fa-user-plus',
  users: 'fa-users',
  wallet: 'fa-wallet',
  wifi: 'fa-wifi',
  x: 'fa-xmark',
  xcircle: 'fa-circle-xmark',
  zap: 'fa-bolt',
};

interface FaProps {
  name: string;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}

export default function Fa({ name, className = '', style, onClick }: FaProps) {
  const normalized = name.toLowerCase().replace(/-/g, '');
  const iconClass = iconMap[normalized] || iconMap[name.toLowerCase()] || 'fa-circle';
  const isSpin = normalized === 'loader2';
  // Determine if it's a brand icon
  const isBrand = iconClass.startsWith('fa-brands');
  const isRegular = iconClass.startsWith('fa-regular');
  const baseClass = isBrand ? 'fab' : isRegular ? 'far' : 'fas';
  const iconName = iconClass.replace(/^(fa-brands|fa-regular|fa-solid)\s*/, '');
  
  return (
    <i
      className={`${baseClass} ${iconName} ${isSpin ? 'fa-spin' : ''} ${className}`}
      style={style}
      onClick={onClick}
    />
  );
}
