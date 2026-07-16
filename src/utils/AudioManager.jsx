export const audios = {
  ride_start: new Audio("/audios/ride_start.mp3"),
};

const allAudios = Object.values(audios);

export const applyAudioSettings = ({ masterVolume = 1, sfxVolume = 1 } = {}) => {
  const volume = Math.max(0, Math.min(1, masterVolume * sfxVolume));
  allAudios.forEach((audio) => {
    audio.volume = volume;
  });
};

export const playAudio = (audio) => {
  audio.currentTime = 0;
  audio.play().catch(() => {
    // Autoplay is blocked until the user interacts.
  });
};
