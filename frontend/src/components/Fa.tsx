import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { library } from '@fortawesome/fontawesome-svg-core';
import {
  faArrowDown,
  faArrowLeft,
  faArrowRight,
  faArrowRotateLeft,
  faArrowUp,
  faArrowsRotate,
  faAppleWhole,
  faBars,
  faBatteryHalf,
  faBell,
  faBellConcierge,
  faBolt,
  faBox,
  faBriefcase,
  faBuilding,
  faBus,
  faCalendar,
  faCamera,
  faCheck,
  faChevronDown,
  faChevronUp,
  faChevronLeft,
  faChevronRight,
  faCircle,
  faCircleCheck,
  faCircleExclamation,
  faCircleXmark,
  faClock,
  faCloudArrowUp,
  faCopy,
  faCreditCard,
  faDollarSign,
  faDownload,
  faEnvelope,
  faEye,
  faEyeSlash,
  faFileLines,
  faFingerprint,
  faFlagCheckered,
  faHouse,
  faKey,
  faLeftRight,
  faLifeRing,
  faLocationArrow,
  faLock,
  faMagnifyingGlass,
  faMapPin,
  faMinus,
  faMobileScreen,
  faNoteSticky,
  faPencil,
  faPhone,
  faPlay,
  faPlus,
  faQrcode,
  faRestroom,
  faRightFromBracket,
  faRoute,
  faShield,
  faSliders,
  faSnowflake,
  faSpinner,
  faStar,
  faTableColumns,
  faTag,
  faTicket,
  faTrash,
  faTriangleExclamation,
  faTruck,
  faUnlock,
  faUser,
  faUserPlus,
  faUsers,
  faWallet,
  faWifi,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import type { IconProp } from '@fortawesome/fontawesome-svg-core';

/**
 * Add every icon we use to the FontAwesome library exactly once. This is the
 * official pattern from the docs (`library.add(...)` then `icon={["fas","..."]}`
 * or `icon={definition}`) — it lets the React component resolve names without
 * us having to build a custom lookup table.
 *
 * All icons are free solid (`fas`). The project is on the free tier; we do
 * not import `far` or `fab` to keep the bundle small.
 */
library.add(
  faArrowDown,
  faArrowLeft,
  faArrowRight,
  faArrowRotateLeft,
  faArrowUp,
  faArrowsRotate,
  faAppleWhole,
  faBars,
  faBatteryHalf,
  faBell,
  faBellConcierge,
  faBolt,
  faBox,
  faBriefcase,
  faBuilding,
  faBus,
  faCalendar,
  faCamera,
  faCheck,
  faChevronDown,
  faChevronUp,
  faChevronLeft,
  faChevronRight,
  faCircle,
  faCircleCheck,
  faCircleExclamation,
  faCircleXmark,
  faClock,
  faCloudArrowUp,
  faCopy,
  faCreditCard,
  faDollarSign,
  faDownload,
  faEnvelope,
  faEye,
  faEyeSlash,
  faFileLines,
  faFingerprint,
  faFlagCheckered,
  faHouse,
  faKey,
  faLeftRight,
  faLifeRing,
  faLocationArrow,
  faLock,
  faMagnifyingGlass,
  faMapPin,
  faMinus,
  faMobileScreen,
  faNoteSticky,
  faPencil,
  faPhone,
  faPlay,
  faPlus,
  faQrcode,
  faRestroom,
  faRightFromBracket,
  faRoute,
  faShield,
  faSliders,
  faSnowflake,
  faSpinner,
  faStar,
  faTableColumns,
  faTag,
  faTicket,
  faTrash,
  faTriangleExclamation,
  faTruck,
  faUnlock,
  faUser,
  faUserPlus,
  faUsers,
  faWallet,
  faWifi,
  faXmark,
);

/**
 * Map of legacy / Lucide-style / FA6-style icon names the codebase carries
 * over from the previous Lucide-React migration, mapped to Font Awesome 7
 * `iconName` strings. Anything not in this map is assumed to already be a
 * valid FA7 `iconName` (kebab-case, e.g. `"map-pin"`).
 *
 * This is the only "translation layer" between call sites and the icon
 * library; we no longer ship a custom lookup or `Object.values(fas)` —
 * the official `library.add()` + string-array `icon` prop handles resolution.
 */
const aliases: Record<string, string> = {
  // Lucide / FA6 style -> FA7 iconName
  alertcircle: 'circle-exclamation',
  alerttriangle: 'triangle-exclamation',
  'alert-circle': 'circle-exclamation',
  bellring: 'bell-concierge',
  checkcircle: 'circle-check',
  'check-circle2': 'circle-check',
  chevrondown: 'chevron-down',
  chevronleft: 'chevron-left',
  chevronright: 'chevron-right',
  'cloud-upload-alt': 'cloud-arrow-up',
  creditcard: 'credit-card',
  dollarsign: 'dollar-sign',
  eyeoff: 'eye-slash',
  shieldcheck: 'circle-check',
  slidershorizontal: 'sliders',
  stickynote: 'note-sticky',
  trash2: 'trash',
  userplus: 'user-plus',
  x: 'xmark',
  xcircle: 'circle-xmark',
  rotateccw: 'arrow-rotate-left',
  refreshcw: 'arrows-rotate',
  'sign-out-alt': 'right-from-bracket',
  arrowleftright: 'left-right',
  loader2: 'spinner',
  // FA6 -> FA7 renames (the canonical iconName changed)
  mail: 'envelope',
  home: 'house',
  menu: 'bars',
  package: 'box',
  apple: 'apple-whole',
  smartphone: 'mobile-screen',
  navigation: 'location-arrow',
  zap: 'bolt',
  search: 'magnifying-glass',
  // Names that are not in `fas` and have no close equivalent — fall back to
  // a sensible related icon. These should be revisited as design choices.
  busfront: 'bus',
  'layout-dashboard': 'table-columns',
  layoutdashboard: 'table-columns',
  settingsicon: 'sliders',
  // AmenityIcons
  wifi: 'wifi',
  snowflake: 'snowflake',
  batterycharging: 'battery-3-full',
  toilet: 'restroom',
};

const FALLBACK: IconProp = ['fas', 'circle-question'];

interface FaProps {
  name: string;
  className?: string;
  onClick?: () => void;
}

/** Resolve a user-supplied icon name to a FA7 `iconName` (kebab-case). */
function resolve(name: string): string {
  if (aliases[name]) return aliases[name];
  // Names like "map-pin" are already valid kebab FA7 iconNames.
  if (name.includes('-') || /^[a-z0-9]+$/i.test(name)) return name;
  // Anything else is unknown — fall through to the FALLBACK and warn once
  // per distinct unknown name.
  if (!warned.has(name)) {
    warned.add(name);
    // eslint-disable-next-line no-console
    console.warn(`Fa: icon "${name}" not found — rendering fallback`);
  }
  return '';
}

const warned = new Set<string>();

export default function Fa({ name, className, onClick }: FaProps) {
  const iconName = resolve(name);
  const icon: IconProp = iconName ? (['fas', iconName] as IconProp) : FALLBACK;
  return (
    <FontAwesomeIcon icon={icon} className={className} onClick={onClick} />
  );
}
