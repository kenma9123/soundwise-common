'use strict';

const path = require('path');
const isEmpty = require('lodash/isEmpty');
const ffmpeg = require('../../common/ffmpeg');
const { getPathBasename, safeUnlink } = require('../../helpers/utils');
const getNormalizeAudioPath = spath => `${getPathBasename(spath)}_set_volume${path.extname(spath)}`;

/**
 * Normalize the different parts of an audio to have consistent volume
 * @param filepath - the audio file to process
 */
module.exports = (filepath = '') => {
  return new Promise((resolve, reject) => {
    try {
      if (isEmpty(filepath)) {
        throw new Error('Normalize volume input file is missing');
      }

      // *** Set volume target and harmonize loudness level ***
      // set Integrated loudness to -14: I=-14
      // set True peak value to -3: TP=-2
      // set Loudness range to 11: LRA=11
      // ffmpeg -i audio.mp3 -af loudnorm=I=-14:TP=-2:LRA=11:measured_I=-19.5:measured_LRA=5.7:measured_TP=-0.1:measured_thresh=-30.20::linear=true:print_format=summary -ar 44.1k audio-normalized.mp3
      const setVolumePath = getNormalizeAudioPath(filepath);
      const filters = [
        'loudnorm=I=-14',
        'TP=-2',
        'LRA=11',
        'measured_I=-19.5',
        'measured_LRA=5.7',
        'measured_TP=-0.1',
        'measured_thresh=-30.20',
        'linear=true',
        'print_format=summary',
      ].join(':');

      new ffmpeg(filepath)
        .then(file => {
          file.addCommand('-y'); // overwrite existing
          file.addCommand('-hide_banner');
          file.addCommand('-af', filters);
          file.addCommand('-ar', `44.1k`);
          file.addCommand('-q:a', '3');
          file.saveOriginal([
            setVolumePath,
            err => {
              if (err) {
                return reject(
                  new Error(`Unable to normalize volume audio file ${filepath}. ${err.message}`)
                );
              }

              safeUnlink(filepath); // remove original
              resolve(setVolumePath);
            },
          ]);
        })
        .catch(err => {
          reject(new Error(`Error loading file ${filepath} for normalize volume. ${err.message}`));
        });
    } catch (err) {
      reject(err);
    }
  });
};
