let audioContext: AudioContext | null = null;

type CelebrationSoundKind =
  | "STAR"
  | "SUCCESS"
  | "SPARKLE"
  | "LEVEL_UP"
  | "FANFARE";

function getAudioContext() {
  if (typeof window === "undefined") return null;

  const AudioContextConstructor =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;

  if (!AudioContextConstructor) return null;

  if (!audioContext) {
    audioContext = new AudioContextConstructor();
  }

  return audioContext;
}

function playTone(params: {
  context: AudioContext;
  frequency: number;
  startAt: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
}) {
  const oscillator = params.context.createOscillator();
  const gainNode = params.context.createGain();

  oscillator.type = params.type ?? "sine";
  oscillator.frequency.setValueAtTime(params.frequency, params.startAt);

  const volume = params.gain ?? 0.12;

  gainNode.gain.setValueAtTime(0.0001, params.startAt);
  gainNode.gain.exponentialRampToValueAtTime(
    volume,
    params.startAt + 0.015,
  );
  gainNode.gain.exponentialRampToValueAtTime(
    0.0001,
    params.startAt + params.duration,
  );

  oscillator.connect(gainNode);
  gainNode.connect(params.context.destination);

  oscillator.start(params.startAt);
  oscillator.stop(params.startAt + params.duration + 0.03);
}

async function ensureAudioReady() {
  const context = getAudioContext();

  if (!context) return false;

  if (context.state === "suspended") {
    await context.resume();
  }

  return context.state === "running";
}

function playSoundPattern(kind: CelebrationSoundKind) {
  const context = getAudioContext();

  if (!context) return;

  const now = context.currentTime;

  if (kind === "STAR") {
    playTone({
      context,
      frequency: 880,
      startAt: now,
      duration: 0.13,
      type: "triangle",
    });
    playTone({
      context,
      frequency: 1320,
      startAt: now + 0.12,
      duration: 0.16,
      type: "triangle",
    });
    return;
  }

  if (kind === "SUCCESS") {
    playTone({
      context,
      frequency: 523.25,
      startAt: now,
      duration: 0.12,
      type: "sine",
    });
    playTone({
      context,
      frequency: 659.25,
      startAt: now + 0.11,
      duration: 0.12,
      type: "sine",
    });
    playTone({
      context,
      frequency: 783.99,
      startAt: now + 0.22,
      duration: 0.2,
      type: "sine",
    });
    return;
  }

  if (kind === "SPARKLE") {
    [1174.66, 1567.98, 2093].forEach((frequency, index) => {
      playTone({
        context,
        frequency,
        startAt: now + index * 0.08,
        duration: 0.09,
        type: "triangle",
        gain: 0.09,
      });
    });
    return;
  }

  if (kind === "LEVEL_UP") {
    [392, 523.25, 659.25, 783.99].forEach((frequency, index) => {
      playTone({
        context,
        frequency,
        startAt: now + index * 0.09,
        duration: 0.12,
        type: "square",
        gain: 0.08,
      });
    });
    return;
  }

  [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
    playTone({
      context,
      frequency,
      startAt: now + index * 0.1,
      duration: 0.16,
      type: "triangle",
      gain: 0.11,
    });
  });
}

export function resolveCelebrationSoundKind(params: {
  points: number;
  title?: string;
  description?: string;
}): CelebrationSoundKind {
  const text = `${params.title ?? ""} ${params.description ?? ""}`;

  if (text.includes("إنجاز") || text.includes("شارة")) {
    return "LEVEL_UP";
  }

  if (params.points >= 10) {
    return "FANFARE";
  }

  if (params.points >= 5) {
    return "SUCCESS";
  }

  const sounds: CelebrationSoundKind[] = ["STAR", "SPARKLE", "SUCCESS"];

  return sounds[Math.floor(Math.random() * sounds.length)] ?? "STAR";
}

export async function unlockClassroomDisplaySound() {
  return ensureAudioReady();
}

export async function playClassroomDisplayCelebrationSound(
  kind: CelebrationSoundKind,
) {
  const ready = await ensureAudioReady();

  if (!ready) return false;

  playSoundPattern(kind);

  return true;
}