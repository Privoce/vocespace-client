import { SvgResource } from '@/app/resources/svg';
import styles from '@/styles/controls.module.scss';

export function SelectedMask() {
  return (
    <div className={styles.selected_mask}>
      <SvgResource type="check" svgSize={24} color="#22CCEE"></SvgResource>
    </div>
  );
}
