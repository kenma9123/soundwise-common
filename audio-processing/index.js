'use strict';

const ffmpeg = require('../../common/ffmpeg');
const detectSilence = require('./detectSilence');
const audioOverRead = require('./audioOverRead');
const setMP3Codec = require('./setMP3Codec');
const downloadIntroOutro = require('./downloadIntroOutro');
const removeAudioSilence = require('./removeSilence');
const removeAllAudioSilence = require('./removeAllSilence');
const introAudioProcessing = require('./introAudio');
const outroAudioProcessing = require('./outroAudio');
const concatIntroOutro = require('./concatIntroOutro');
const normalizeVolume = require('./normalizeVolume');
const audioTagging = require('./audioTagging');

module.exports = {
  ffmpeg,
  detectSilence,
  audioOverRead,
  setMP3Codec,
  downloadIntroOutro,
  removeAudioSilence,
  removeAllAudioSilence,
  introAudioProcessing,
  outroAudioProcessing,
  concatIntroOutro,
  normalizeVolume,
  audioTagging,
};
