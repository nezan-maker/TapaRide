import React from 'react';

const iconMap: Record<string, string> = {
  ac: 'fa-solid fa-snowflake',
  alertcircle: 'fa-solid fa-circle-exclamation',
  alerttriangle: 'fa-solid fa-triangle-exclamation',
  apple: 'fa-brands fa-apple',
  arrowdown: 'fa-solid fa-arrow-down',
  arrowleft: 'fa-solid fa-arrow-left',
  arrowleftright: 'fa-solid fa-arrows-left-right',
  arrowright: 'fa-solid fa-arrow-right',
  arrowup: 'fa-solid fa-arrow-up',
  batterycharging: 'fa-solid fa-battery-bolt',
  bell: 'fa-solid fa-bell',
  bellring: 'fa-solid fa-bell',
  bus: 'fa-solid fa-bus',
  busbooking: 'fa-solid fa-bus',
  busfront: 'fa-solid fa-bus-simple',
  calendar: 'fa-solid fa-calendar',
  camera: 'fa-solid fa-camera',
  charging: 'fa-solid fa-battery-bolt',
  check: 'fa-solid fa-check',
  checkcircle: 'fa-solid fa-circle-check',
  checkcircle2: 'fa-regular fa-circle-check',
  chevrondown: 'fa-solid fa-chevron-down',
  chevronleft: 'fa-solid fa-chevron-left',
  chevronright: 'fa-solid fa-chevron-right',
  circle: 'fa-regular fa-circle',
  circlecheck: 'fa-regular fa-circle-check',
  circlexmark: 'fa-solid fa-circle-xmark',
  clock: 'fa-solid fa-clock',
  clouduploadalt: 'fa-solid fa-cloud-arrow-up',
  copy: 'fa-regular fa-copy',
  creditcard: 'fa-regular fa-credit-card',
  dollarsign: 'fa-solid fa-dollar-sign',
  download: 'fa-solid fa-download',
  eye: 'fa-solid fa-eye',
  eyeoff: 'fa-solid fa-eye-slash',
  filelines: 'fa-solid fa-file-lines',
  fingerprint: 'fa-solid fa-fingerprint',
  gps: 'fa-solid fa-location-crosshairs',
  home: 'fa-solid fa-house',
  info: 'fa-solid fa-info-circle',
  layoutdashboard: 'fa-solid fa-gauge-high',
  lifering: 'fa-solid fa-life-ring',
  lightbulb: 'fa-solid fa-lightbulb',
  loader2: 'fa-solid fa-spinner',
  lock: 'fa-solid fa-lock',
  logout: 'fa-solid fa-right-from-bracket',
  mail: 'fa-solid fa-envelope',
  mappin: 'fa-solid fa-location-dot',
  megaphone: 'fa-solid fa-bullhorn',
  menu: 'fa-solid fa-bars',
  message: 'fa-solid fa-message',
  minus: 'fa-solid fa-minus',
  mobile: 'fa-solid fa-mobile-screen-button',
  moon: 'fa-solid fa-moon',
  navigation: 'fa-solid fa-location-arrow',
  package: 'fa-solid fa-box',
  passenger: 'fa-solid fa-user',
  passengersafe: 'fa-solid fa-user-check',
  pencil: 'fa-solid fa-pencil',
  phone: 'fa-solid fa-phone',
  play: 'fa-solid fa-play',
  plus: 'fa-solid fa-plus',
  qrcode: 'fa-solid fa-qrcode',
  refreshcw: 'fa-solid fa-rotate',
  restroom: 'fa-solid fa-toilet',
  rotateccw: 'fa-solid fa-arrow-rotate-left',
  search: 'fa-solid fa-magnifying-glass',
  settings: 'fa-solid fa-gear',
  shield: 'fa-solid fa-shield',
  shieldcheck: 'fa-solid fa-shield-halved',
  signoutalt: 'fa-solid fa-right-from-bracket',
  smartphone: 'fa-solid fa-mobile-screen-button',
  slidershorizontal: 'fa-solid fa-sliders',
  snowflake: 'fa-solid fa-snowflake',
  star: 'fa-solid fa-star',
  staro: 'fa-regular fa-star',
  stickynote: 'fa-regular fa-note-sticky',
  stopeta: 'fa-solid fa-clock',
  stopreached: 'fa-solid fa-flag-checkered',
  sun: 'fa-solid fa-sun',
  sunset: 'fa-solid fa-cloud-sun',
  tag: 'fa-solid fa-tag',
  ticket: 'fa-solid fa-ticket',
  toilet: 'fa-solid fa-toilet',
  trash2: 'fa-solid fa-trash',
  truck: 'fa-solid fa-truck',
  unlock: 'fa-solid fa-unlock',
  upload: 'fa-solid fa-upload',
  user: 'fa-solid fa-user',
  userplus: 'fa-solid fa-user-plus',
  users: 'fa-solid fa-users',
  wallet: 'fa-solid fa-wallet',
  wifi: 'fa-solid fa-wifi',
  x: 'fa-solid fa-xmark',
  xcircle: 'fa-solid fa-circle-xmark',
  zap: 'fa-solid fa-bolt',
};

interface FaProps {
  name: string;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}

export default function Fa({ name, className = '', style, onClick }: FaProps) {
  const normalized = name.toLowerCase().replace(/-/g, '');
  const faClass = iconMap[normalized] || 'fa-solid fa-circle';
  const isSpin = normalized === 'loader2';
  return (
    <i
      className={`${faClass} ${isSpin ? 'fa-spin' : ''} ${className}`}
      style={style}
      onClick={onClick}
    />
  );
}
