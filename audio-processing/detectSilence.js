'use strict';

const isEmpty = require('lodash/isEmpty');
const ffmpeg = require('../../common/ffmpeg');

/**
 * detect the silence in audio stream
 * @param filepath - the audio file to process
 * @param option - the ffmpeg silenece option
 */
module.exports = (filepath = '', options = {}) => {
  return new Promise((resolve, reject) => {
    if (isEmpty(filepath)) {
      return reject(new Error('Detect silence input file is missing'));
    }

    // get the noise tolerance and duration
    const { noise = -60, duration = 1 } = options;
    new ffmpeg(filepath)
      .then(audio => {
        audio.addCommand('-y'); // overwrite existing
        audio.addCommand('-hide_banner');
        audio.addCommand('-af', `silencedetect=n=${noise}dB:d=${duration}`);
        audio.addCommand('-f', `null`);
        audio.saveOriginal(['-', (...args) => resolve([audio, args])]);
      })
      .catch(err => {
        reject(new Error(`Error loading file ${filepath} for silence detect. ${err.message}`));
      });
  });
};
