'use strict';

const isEmpty = require('lodash/isEmpty');
const ffmpeg = require('../../common/ffmpeg');
const { getOutroFadePath, getFadeData } = require('./utils');
const { safeUnlink } = require('../../helpers/utils');

// process the intro file for main audio stream
// @param filepath - the audio file to process
// @param overlayDuration - the duration for main audio overlapping
module.exports = (filepath = '', overlayDuration = 0) => {
  return new Promise(async (resolve, reject) => {
    try {
      if (isEmpty(filepath)) {
        return reject('Outro processing input file is missing');
      }

      new ffmpeg(filepath)
        .then(file => {
          const milliseconds = file.metadata.duration.raw.split('.')[1] || 0;
          const outroDuration = Number(file.metadata.duration.seconds + '.' + milliseconds);
          if (overlayDuration) {
            // make fading effect
            // a. fade in an outro clip
            // ffmpeg -i outro.mp3 -af 'afade=t=in:ss=0:d=5,afade=out:st=885:d=5' outro-fadein.mp3
            const outroFadePath = getOutroFadePath(filepath);
            const { fadeStart, fadeDuration } = getFadeData(overlayDuration, outroDuration);
            const fadein = `afade=t=in:st=0:d=${overlayDuration * 2}`;
            const fadeout = `afade=t=out:st=${fadeStart}:d=${fadeDuration}`;
            file.addCommand('-y'); // overwrite existing
            file.addCommand('-hide_banner');
            file.addCommand('-af', `${fadein},${fadeout}`);
            file.addCommand('-q:a', '3');
            file.saveOriginal([
              outroFadePath,
              err => {
                if (err) {
                  return reject(
                    new Error(`Processing outro fade failed ${outroFadePath}. ${err.message}`)
                  );
                }

                // remove original outro
                safeUnlink(filepath);
                resolve([outroFadePath, outroDuration]);
              },
            ]);
          } else {
            resolve([filepath, outroDuration]);
          }
        })
        .catch(err => {
          reject(new Error(`Error loading file ${filepath} for outro processing. ${err.message}`));
        });
    } catch (err) {
      reject(err);
    }
  });
};
