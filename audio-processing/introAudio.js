'use strict';

const fs = require('fs');
const isEmpty = require('lodash/isEmpty');
const ffmpeg = require('../../common/ffmpeg');
const { getIntroFadePath, getFadeData } = require('./utils');
const { safeUnlink } = require('../../helpers/utils');

/**
 * process the intro file for main audio stream
 * @param filepath - the audio file to process
 * @param overlayDuration - the duration for main audio overlapping
 */
module.exports = (filepath = '', overlayDuration = 0) => {
  return new Promise(async (resolve, reject) => {
    try {
      if (isEmpty(filepath)) {
        return reject('Intro processing input file is missing');
      }

      new ffmpeg(filepath)
        .then(file => {
          const milliseconds = file.metadata.duration.raw.split('.')[1] || 0;
          const introDuration = Number(file.metadata.duration.seconds + '.' + milliseconds);
          if (overlayDuration) {
            // make fading effect
            // a. fade out an intro
            // ffmpeg -i intro.mp3 -af 'afade=t=out:st=885:d=5' intro-fadeout.mp3
            const introFadePath = getIntroFadePath(filepath);
            const { fadeStart, fadeDuration } = getFadeData(overlayDuration, introDuration);
            file.addCommand('-y'); // overwrite existing
            file.addCommand('-hide_banner');
            file.addCommand('-af', `afade=t=out:st=${fadeStart}:d=${fadeDuration}`);
            file.addCommand('-q:a', '3');
            file.saveOriginal([
              introFadePath,
              err => {
                if (err) {
                  return reject(
                    new Error(`Processing intro fade failed ${introFadePath}. ${err.message}`)
                  );
                }

                // remove original intro
                safeUnlink(filepath);
                resolve([introFadePath, introDuration]);
              },
            ]);
          } else {
            resolve([filepath, introDuration]);
          }
        })
        .catch(err => {
          reject(new Error(`Error loading file ${filepath} for intro processing. ${err.message}`));
        });
    } catch (err) {
      reject(err);
    }
  });
};
