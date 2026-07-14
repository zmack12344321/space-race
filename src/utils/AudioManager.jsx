export const audios = {
  ride_start: new Audio("/audios/ride_start.mp3"),
};

export const playAudio = (audio) => {
  audio.currentTime = 0;
  audio.play().catch(() => {
    // Autoplay is blocked until the user interacts.
  });
};
