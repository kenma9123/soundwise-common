'use strict';

const path = require('path');
const chunk = require('lodash/chunk');
const { AWS_BUCKET } = require('../../config');
const createLogger = require('../../helpers/createLogger');
const { getFilename, getPathBasename } = require('../../helpers/utils');
const { EPISODE_PROCESSING_FOLDER } = require('../../queues/episode/config');

const processingLogger = createLogger('PROCESSING:');

const getProcessingAudioPath = (name, extension) =>
  path.join(EPISODE_PROCESSING_FOLDER, `audio_processing_${name}.${extension}`);

const getCoverImagePath = (name, extension) =>
  path.join(EPISODE_PROCESSING_FOLDER, `audio_processing_${name}_cover.${extension}`);

const getIntroAudioSavePath = (spath, extension) => `${getPathBasename(spath)}_intro.${extension}`;

const getOutroAudioSavePath = (spath, extension) => `${getPathBasename(spath)}_outro.${extension}`;

const getIntroFadePath = spath => `${getPathBasename(spath)}_fadeintro${path.extname(spath)}`;

const getOutroFadePath = spath => `${getPathBasename(spath)}_fadeoutro${path.extname(spath)}`;

const getS3UrlEquivalent = url => {
  if (url.includes('https://app.mysoundwise.com')) {
    const filename = getFilename(url);
    return `http://s3.amazonaws.com/${AWS_BUCKET}/soundcasts/${filename}`;
  }

  return url;
};

const parseSilence = str =>
  str
    .replace(/\[silencedetect/g, '\n[silencedetect')
    .split('\n')
    .filter(i => i.slice(0, 14) === '[silencedetect')
    .map(i => i.split('] ')[1])
    .join(' | ')
    .split(' | ');

const parseSilenceDetect = str => parseSilence(str).map(i => i.split(': '));

const parseSilenceDetectInChunks = str => {
  const chunks = chunk(parseSilence(str), 3);
  return chunks.map(chnk => {
    return chnk.map(i => i.split(': '));
  });
};

const trimText = text =>
  text
    .replace(/"/g, `\\"`)
    .replace(/`/g, '\\`')
    .replace(/\r?\n|\r/g, '');

const getFadeData = (overlayDuration, fileDuration) => {
  // One thing to note is that if overlayDuration > 0, the intro fade out duration should be overlayDuration x 2
  const fadeDuration = overlayDuration * 2;
  let fadeStart = Math.round((fileDuration - fadeDuration) * 100) / 100;
  if (fadeStart < 0) {
    fadeStart = 0; // Value for parameter 'st' should be in range [0 - 9.22337e+12]
  }

  return { fadeStart, fadeDuration };
};

module.exports = {
  processingLogger,
  getS3UrlEquivalent,
  getProcessingAudioPath,
  getCoverImagePath,
  getIntroAudioSavePath,
  getOutroAudioSavePath,
  getIntroFadePath,
  getOutroFadePath,
  parseSilenceDetect,
  parseSilenceDetectInChunks,
  trimText,
  getFadeData,
};
