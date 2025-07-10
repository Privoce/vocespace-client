import { SvgResource, SvgType } from "@/app/resources/svg";

export function TabItem({ type, label }: { type: SvgType; label: string }) {
  const tabStyles = {
    display: 'inline-flex',
    alignItems: 'center',
    width: '100%',
    height: '100%',
    justifyContent: 'space-between',
    gap: '6px',
  };

  return (
    <div style={tabStyles}>
      <SvgResource type={type} svgSize={14}></SvgResource>
      {label}
    </div>
  );
}
