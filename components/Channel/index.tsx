import { getChannelContent, type ChannelModel } from './content';
import { ChannelPC } from './pc';
import { ChannelPhone } from './phone';

export function ChannelSurface({ model }: { model: ChannelModel }) {
  const { mainItems, modals } = getChannelContent(model);
  return (
    <>
      {model.device === 'phone' ? (
        <ChannelPhone model={model} mainItems={mainItems} />
      ) : (
        <ChannelPC model={model} mainItems={mainItems} />
      )}{' '}
      {modals}
    </>
  );
}
