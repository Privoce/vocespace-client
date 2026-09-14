
export interface ToggleProps {
  enabled: boolean;
  onClicked: (enabled: boolean) => void;
  showText?: boolean;
  controlWidth: number;
}
