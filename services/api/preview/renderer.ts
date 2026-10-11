/** Dedicated Egress source. It never loads the conference app, business Socket, chat or AI. */
import { Room, RoomEvent, Track } from 'livekit-client';
const room = new Room({ adaptiveStream: false, dynacast: false });
let allowed = new Set<string>();
let stopped = false;
let timer: ReturnType<typeof setTimeout> | undefined;
const elements = new Map<string, HTMLElement>();
const stop = async () => {
  stopped = true;
  clearTimeout(timer);
  document.getElementById('tiles')!.replaceChildren();
  await room.disconnect();
  console.log('END_RECORDING');
};
const details = async () => {
  const url = new URL('./details', location.href);
  url.search = location.search;
  const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(4000) });
  if (!response.ok) throw new Error('SOURCE_REVOKED');
  return response.json() as Promise<{
    token: string;
    serverUrl: string;
    members: { id: string; name: string }[];
  }>;
};
const subscribe = () => {
  for (const participant of room.remoteParticipants.values()) {
    for (const publication of participant.trackPublications.values())
      publication.setSubscribed(allowed.has(participant.identity));
  }
};
function refreshTiles() {
  for (const [identity, tile] of elements) {
    const participant = room.remoteParticipants.get(identity);
    const videos = Array.from(tile.querySelectorAll('video'));
    const visible = videos.find(
      (video) => participant?.getTrackPublicationBySid(video.dataset.sid!)?.isMuted === false,
    );
    for (const video of videos) video.style.display = video === visible ? 'block' : 'none';
    tile.querySelector('span')?.toggleAttribute('hidden', !!visible);
  }
}
room.on(RoomEvent.TrackMuted, refreshTiles);
room.on(RoomEvent.TrackUnmuted, refreshTiles);
room.on(RoomEvent.TrackPublished, subscribe);
room.on(RoomEvent.ParticipantConnected, subscribe);
room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
  if (!allowed.has(participant.identity) || stopped) {
    publication.setSubscribed(false);
    return;
  }
  const tile = elements.get(participant.identity);
  if (!tile) return;
  const media = track.attach();
  media.autoplay = true;
  if (track.kind === Track.Kind.Video) {
    media.setAttribute('playsinline', '');
    media.dataset.sid = publication.trackSid;
    // Prefer shared screen over camera when both are published, while retaining main-room audio.
    if (track.source === Track.Source.ScreenShare) tile.prepend(media);
    else tile.append(media);
    refreshTiles();
  } else tile.append(media);
  void media.play().catch(() => undefined);
});
room.on(RoomEvent.TrackUnsubscribed, (track) => {
  track.detach().forEach((element) => element.remove());
  refreshTiles();
});
async function run() {
  const source = await details();
  allowed = new Set(source.members.map((member) => member.id));
  for (const member of source.members) {
    const tile = document.createElement('section');
    const avatar = document.createElement('span');
    avatar.textContent = member.name.slice(0, 1);
    const label = document.createElement('label');
    label.textContent = member.name;
    tile.append(avatar, label);
    document.getElementById('tiles')!.append(tile);
    elements.set(member.id, tile);
  }
  await room.connect(source.serverUrl, source.token, { autoSubscribe: false });
  subscribe();
  console.log('START_RECORDING');
  const verify = async () => {
    try {
      await details();
      if (!stopped)
        timer = setTimeout(() => {
          void verify();
        }, 1000);
    } catch {
      await stop();
    }
  };
  timer = setTimeout(() => {
    void verify();
  }, 1000);
}
void run().catch(stop);
window.addEventListener('pagehide', () => {
  void stop();
});
