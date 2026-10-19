import type { ReactNode } from 'react';

/** Web content order; platform adapters retain their existing DOM/native controls. */
export function spaceEntryContent(slots: {
  frame: (children: ReactNode) => ReactNode;
  context?: ReactNode;
  tabs: ReactNode;
  description: ReactNode;
  input?: ReactNode;
  submit: ReactNode;
  options: ReactNode;
}) {
  return slots.frame(
    <>
      {slots.context}
      {slots.tabs}
      {slots.description}
      {slots.input}
      {slots.submit}
      {slots.options}
    </>,
  );
}
export function participantRowContent(slots: {
  row: (children: ReactNode) => ReactNode;
  identity: (children: ReactNode) => ReactNode;
  avatar: ReactNode;
  name: ReactNode;
  roles: ReactNode;
  suffix?: ReactNode;
}) {
  return slots.row(
    <>
      {slots.identity(
        <>
          {slots.avatar}
          {slots.name}
          {slots.roles}
        </>,
      )}
      {slots.suffix}
    </>,
  );
}
export function channelContent(slots: { main: ReactNode; rooms: ReactNode }) {
  return (
    <>
      {slots.main}
      {slots.rooms}
    </>
  );
}

/** Original AppFlotIconCollect order, with platform-owned actions and dialogs. */
export function tileWidgetsContent(slots: {
  frame: (children: ReactNode) => ReactNode;
  app?: ReactNode;
  avo?: ReactNode;
  fullscreen?: ReactNode;
  dialog?: ReactNode;
  focus?: ReactNode;
}) {
  return slots.frame(
    <>
      {slots.app}
      {slots.avo}
      {slots.fullscreen}
      {slots.dialog}
      {slots.focus}
    </>,
  );
}

/** Existing Web PreJoin structure; devices and connection lifecycle stay in the adapters. */
export function preJoinContent(slots: {
  frame: (children: ReactNode) => ReactNode;
  controls: (children: ReactNode) => ReactNode;
  context?: ReactNode;
  language: ReactNode;
  preview: ReactNode;
  audio: ReactNode;
  video: ReactNode;
  login?: ReactNode;
  username: ReactNode;
  submit: ReactNode;
  status?: ReactNode;
}) {
  return slots.frame(
    <>
      {slots.context}
      {slots.language}
      {slots.preview}
      {slots.controls(
        <>
          {slots.audio}
          {slots.video}
          {slots.login}
          {slots.username}
          {slots.submit}
        </>,
      )}
      {slots.status}
    </>,
  );
}
