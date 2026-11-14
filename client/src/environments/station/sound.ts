// The station's ambience: trains rumbling somewhere down the tunnels, echoing off
// the tiles, and the strip lights' hum. Kept low, under the game's own sounds.
import type { EnvCtx } from "../types.ts";

type Bed = Parameters<EnvCtx["sound"]["bed"]>[0];

export const stationBed: Bed = (c, out) => {
  // brown noise, low-passed: a train a few stations away
  const length = c.sampleRate * 4;
  const buffer = c.createBuffer(1, length, c.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    data[i] = last * 3.5;
  }
  const rumble = c.createBufferSource();
  rumble.buffer = buffer;
  rumble.loop = true;
  const low = c.createBiquadFilter();
  low.type = "lowpass";
  low.frequency.value = 160;
  const swell = c.createGain();
  swell.gain.value = 0.014;
  // it comes and goes, like trains do
  const lfo = c.createOscillator();
  lfo.frequency.value = 0.045;
  const depth = c.createGain();
  depth.gain.value = 0.011;
  lfo.connect(depth).connect(swell.gain);
  rumble.connect(low).connect(swell).connect(out);
  // the echo off the tiles
  const echo = c.createDelay(1);
  echo.delayTime.value = 0.33;
  const feedback = c.createGain();
  feedback.gain.value = 0.45;
  const wet = c.createGain();
  wet.gain.value = 0.6;
  swell.connect(echo).connect(feedback).connect(echo);
  echo.connect(wet).connect(out);
  // the strip lights' hum
  const hum = c.createOscillator();
  hum.type = "triangle";
  hum.frequency.value = 120;
  const humGain = c.createGain();
  humGain.gain.value = 0.006;
  hum.connect(humGain).connect(out);
  rumble.start();
  lfo.start();
  hum.start();
  return () => {
    rumble.stop();
    lfo.stop();
    hum.stop();
    echo.disconnect();
  };
};
