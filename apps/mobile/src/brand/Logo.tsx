import { useColorScheme } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { MARK, WORDMARK } from './paths';

const SKY = '#0EA5E9';
const SKY_ON_DARK = '#38BDF8';
const NAVY = '#0B3D91';

/** The Ugent wordmark: sky letters with the navy "cursor" bar under the t. */
export function Wordmark({ width = 160 }: { width?: number }) {
  const dark = useColorScheme() === 'dark';
  const h = (width * WORDMARK.height) / WORDMARK.width;
  const b = WORDMARK.bar;
  return (
    <Svg width={width} height={h} viewBox={WORDMARK.viewBox} accessibilityLabel="Ugent">
      <Path d={WORDMARK.letters} fill={dark ? SKY_ON_DARK : SKY} />
      <Rect x={b.x} y={b.y} width={b.width} height={b.height} rx={b.height / 2} fill={dark ? '#FFFFFF' : NAVY} />
    </Svg>
  );
}

/** The "U" mark, used where the full wordmark is too wide. */
export function Mark({ size = 40 }: { size?: number }) {
  const dark = useColorScheme() === 'dark';
  const b = MARK.bar;
  return (
    <Svg width={(size * MARK.width) / MARK.height} height={size} viewBox={MARK.viewBox} accessibilityLabel="Ugent">
      <Path d={MARK.letter} fill={dark ? SKY_ON_DARK : SKY} />
      <Rect x={b.x} y={b.y} width={b.width} height={b.height} rx={b.height / 2} fill={dark ? '#FFFFFF' : NAVY} />
    </Svg>
  );
}
