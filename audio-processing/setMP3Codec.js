'use strict';

const isEmpty = require('lodash/isEmpty');
const ffmpeg = require('../../common/ffmpeg');
const { getPathBasename, safeUnlink } = require('../../helpers/utils');
const getMP3CodecForcePath = spath => `${getPathBasename(spath)}_mp3codec.mp3`;

/**
 * set the mp3 codec to given audio file
 * @param filepath - the file audio to set the mp3 codec
 * @param forceMP3Conversion - force the file to use mp3codec (for non mp3 files)
 */
module.exports = (filepath = '', forceMP3Conversion = false) => {
  return new Promise((resolve, reject) => {
    if (isEmpty(filepath)) {
      return reject(new Error('Set mp3 codec input file is missing'));
    }

    const mp3codecPath = getMP3CodecForcePath(filepath);
    new ffmpeg(filepath)
      .then(file => {
        if (forceMP3Conversion || file.metadata.audio.codec !== 'mp3') {
          file.addCommand('-y'); // overwrite existing
          file.addCommand('-hide_banner');
          file.setAudioCodec('mp3').setAudioBitRate(64); // convert to mp3
          file.addCommand('-q:a', '3');
          file.saveOriginal([
            mp3codecPath,
            err => {
              if (err) {
                return reject(
                  new Error(`Setting MP3 Codec failed for file ${mp3codecPath}. ${err.message}`)
                );
              }

              safeUnlink(filepath); // remove original
              resolve(mp3codecPath);
            },
          ]);
        } else {
          resolve(filepath);
        }
      })
      .catch(err => {
        reject(new Error(`Error loading file ${filepath} for set audio mp3 codec. ${err.message}`));
      });
  });
};
