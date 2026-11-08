import Svg, { Circle, Path, Rect } from 'react-native-svg';

/* Simple line icons, 24px grid, 1.8 stroke. */
const P: Record<string, (c: string) => React.ReactNode> = {
  home: () => <><Path d="M3 10.5 12 3l9 7.5" /><Path d="M5 9.5V20h5v-6h4v6h5V9.5" /></>,
  chat: () => <Path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" />,
  calendar: () => <><Rect x="3.5" y="5" width="17" height="15" rx="3" /><Path d="M8 3v4M16 3v4M3.5 10h17" /></>,
  tasks: () => <><Rect x="3.5" y="3.5" width="17" height="17" rx="4" /><Path d="m8 12 3 3 5-6" /></>,
  more: () => <><Rect x="4" y="4" width="6.5" height="6.5" rx="2" /><Rect x="13.5" y="4" width="6.5" height="6.5" rx="2" /><Rect x="4" y="13.5" width="6.5" height="6.5" rx="2" /><Rect x="13.5" y="13.5" width="6.5" height="6.5" rx="2" /></>,
  check: () => <Path d="m5 12.5 4.5 4.5L19 7.5" />,
  mic: () => <><Rect x="9" y="3" width="6" height="11" rx="3" /><Path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" /></>,
  send: () => <Path d="M5 12h13M12 5l7 7-7 7" />,
  plus: () => <Path d="M12 5v14M5 12h14" />,
  chevR: () => <Path d="m9 6 6 6-6 6" />,
  chevL: () => <Path d="m15 6-6 6 6 6" />,
  lock: () => <><Rect x="5" y="10.5" width="14" height="10" rx="2.5" /><Path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></>,
  bolt: () => <Path d="M13 3 5 13.5h6L10 21l8-10.5h-6L13 3Z" />,
  focus: () => <><Circle cx="12" cy="12" r="8.5" /><Circle cx="12" cy="12" r="3.5" /></>,
  trash: () => <Path d="M4 7h16M10 11v6M14 11v6M6 7l1 12.5A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.5L18 7M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7" />,
  dots: () => <><Circle cx="5" cy="12" r="1.2" /><Circle cx="12" cy="12" r="1.2" /><Circle cx="19" cy="12" r="1.2" /></>,
  chart: () => <Path d="M4 20h16M7 16v-5M12 16V7M17 16v-8" />,
  tag: () => <><Path d="M3.5 12.5V5A1.5 1.5 0 0 1 5 3.5h7.5L21 12l-8.5 8.5-9-8Z" /><Circle cx="8" cy="8" r="1.4" /></>,
  shield: () => <Path d="M12 3 4.5 6v5.5c0 4.5 3.2 8 7.5 9.5 4.3-1.5 7.5-5 7.5-9.5V6L12 3Z" />,
  wifiOff: () => <Path d="M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5-2.7M14.5 10.4A10 10 0 0 1 19 13M2 9.5a15 15 0 0 1 4.3-2.6M10.5 5.6A15 15 0 0 1 22 9.5M12 20h.01" />,
  star: () => <Path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3.5Z" />,
  copy: () => <><Rect x="8" y="8" width="12" height="12" rx="2.5" /><Path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8" /></>,
  eye: () => <><Path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><Circle cx="12" cy="12" r="3" /></>,
  car: () => <Path d="M5 16.5V12l2-5h10l2 5v4.5M3.5 12h17M7 16.5v2M17 16.5v2" />,
  moon: () => <Path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />,
  clock: () => <><Circle cx="12" cy="12" r="8.5" /><Path d="M12 7.5V12l3 2" /></>,
  heart: () => <Path d="M12 20s-7.5-4.5-7.5-10A4.3 4.3 0 0 1 12 7.3 4.3 4.3 0 0 1 19.5 10c0 5.5-7.5 10-7.5 10Z" />,
  sun: () => <><Circle cx="12" cy="12" r="4" /><Path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" /></>,
  users: () => <><Circle cx="9" cy="8" r="3.5" /><Path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.5a6.5 6.5 0 0 1 3.5 5.5" /></>,
  cloud: () => <Path d="M7 18.5a4.5 4.5 0 0 1-.6-9 6 6 0 0 1 11.4 1.6A3.8 3.8 0 0 1 17.5 18.5H7Z" />,
  x: () => <Path d="M6 6l12 12M18 6 6 18" />,
  info: () => <><Circle cx="12" cy="12" r="8.5" /><Path d="M12 11v5M12 7.8v.1" /></>,
  link: () => <Path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />,
  pin: () => <><Path d="M12 21s-6.5-5.8-6.5-11a6.5 6.5 0 0 1 13 0c0 5.2-6.5 11-6.5 11Z" /><Circle cx="12" cy="10" r="2.3" /></>,
  bell: () => <Path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15L6 16.5ZM10 20.5a2 2 0 0 0 4 0" />,
  user: () => <><Circle cx="12" cy="8" r="3.8" /><Path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></>,
  robot: () => <><Rect x="5" y="8" width="14" height="11" rx="3" /><Path d="M12 4v4M9 13h.01M15 13h.01M9.5 16.5h5" /></>,
  leaf: () => <Path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14Zm0 0 7-7" />,
  wrench: () => <Path d="M14.5 6.5a4 4 0 0 0 5 5l-8.5 8.5a2.1 2.1 0 0 1-3-3l8.5-8.5a4 4 0 0 0-2-2ZM14.5 6.5 17 4" />,
  search: () => <><Circle cx="11" cy="11" r="6.5" /><Path d="m16 16 4.5 4.5" /></>,
  wave: () => <Path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4" />,
  sync: () => <Path d="M20 11a8 8 0 0 0-14.3-4.3L4 8.5M4 4v4.5h4.5M4 13a8 8 0 0 0 14.3 4.3l1.7-1.8M20 20v-4.5h-4.5" />,
};

export type IconName = keyof typeof P;

export function Icon({ name, color, size = 24, strokeWidth = 1.8 }: { name: IconName; color: string; size?: number; strokeWidth?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {P[name](color)}
    </Svg>
  );
}
