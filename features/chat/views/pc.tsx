import { ChatContent, type ChatPanelModel } from './content';
export function ChatPanelPC({ model }: { model: ChatPanelModel }) { return <ChatContent model={model} />; }
