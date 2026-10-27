import Svg, { Circle, Ellipse, Path, Rect, Line } from 'react-native-svg';
/** Small vector artwork stays crisp at all device scales; no remote image dependency. */
export function RoomIllustration({
  kind,
  size = 100,
}: {
  kind: 'meeting' | 'watch' | 'class';
  size?: number;
}) {
  const tint = kind === 'meeting' ? '#88DCC4' : kind === 'watch' ? '#5BD6ED' : '#D9B174';
  return (
    <Svg width={size} height={size * 0.78} viewBox="0 0 120 94">
      <Ellipse cx="60" cy="83" rx="41" ry="6" fill={tint} opacity={0.12} />
      <Circle cx="19" cy="19" r="2" fill={tint} opacity={0.65} />
      <Path d="M103 13v10m-5-5h10M7 60h7" stroke={tint} strokeWidth="1.4" opacity={0.6} />
      {kind === 'meeting' ? (
        <>
          <Path
            d="M16 38q-8 0-8 9v14q0 9 9 9h6l-8 10 20-10h9q9 0 9-9V47q0-9-9-9Z"
            fill="#456F64"
            stroke={tint}
          />
          <Path
            d="M53 22q-12 0-12 12v16q0 12 12 12h16l15 12-3-12h5q12 0 12-12V34q0-12-12-12Z"
            fill={tint}
          />
          {[55, 68, 81].map((cx) => (
            <Circle key={cx} cx={cx} cy="42" r="2.4" fill="#21594F" />
          ))}
        </>
      ) : kind === 'watch' ? (
        <>
          <Rect x="17" y="25" width="88" height="53" rx="8" fill="#173F4D" stroke={tint} />
          <Rect x="24" y="32" width="74" height="36" rx="3" fill="#245A68" />
          <Path d="m54 39 18 11-18 11Z" fill={tint} />
          <Path d="M56 78v8m13-8v8M42 87h40" stroke={tint} strokeWidth="2" />
        </>
      ) : (
        <>
          <Rect x="16" y="23" width="89" height="49" rx="5" fill="#655238" stroke={tint} />
          <Path
            d="M28 38h23m-23 9h17m-17 9h32m20-22 12 17H68Z"
            stroke={tint}
            fill={tint}
            strokeWidth="2"
          />
          <Line x1="42" y1="73" x2="34" y2="86" stroke={tint} strokeWidth="3" />
          <Line x1="80" y1="73" x2="88" y2="86" stroke={tint} strokeWidth="3" />
        </>
      )}
    </Svg>
  );
}
