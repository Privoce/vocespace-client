import { getChannelContent, type ChannelModel } from './content';
import { ChannelPC } from './pc';

export function ChannelSurface({ model }: { model: ChannelModel }) {
  const { mainItems, modals } = getChannelContent(model);
  return (
    <>
      <ChannelPC model={model} mainItems={mainItems} />
      {modals}
    </>
  );
}
