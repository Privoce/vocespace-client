import { MediaStage, type ConferenceModel } from './media-stage';
export function VideoContainerPC({ model }: { model: ConferenceModel }) {
  const { chatOpen, focusTrack } = model;
  return <div
    className={focusTrack ? 'lk-focus-layout-wrapper' : 'lk-grid-layout-wrapper'}
    style={{
      position: 'relative',
      flex: 1,
      minHeight: 0,
      height: '100%',
      width: chatOpen ? 'calc(100% - 308px)' : '100%',
      padding: '0px 0px 0px 8px',
      marginBottom: 0,
      transition: 'width 0.3s ease-in-out',
    }}
  >
    <MediaStage model={model} />
  </div>;
}
