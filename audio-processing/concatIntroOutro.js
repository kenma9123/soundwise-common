'use strict';

const path = require('path');
const isEmpty = require('lodash/isEmpty');
const ffmpeg = require('../../common/ffmpeg');
const { processingLogger } = require('./utils');
const { getPathBasename, safeUnlink } = require('../../helpers/utils');
const getConcatAudioPath = spath => `${getPathBasename(spath)}_concat${path.extname(spath)}`;
const getDelaysForChannels = delay => {
  // converting to milliseconds
  delay = Math.floor(delay * 1000);
  const delays = [delay];

  // *because adelay can't accept all= option to delay all channels in -filter_complex
  // we use approach from https://trac.ffmpeg.org/ticket/5855#comment:4 ("4000|4000|4000|...")
  // ffmpeg -i main.mp3 -i intro.mp3 -i outro.mp3 -filter_complex "[0]adelay=4000|4000|4000|4000[a];[2]adelay=7000|7000|7000|7000[b];[1][a][b]amix=3" out_test.mp3
  for (var i = 0; i < 8; i++) {
    // 8 audio channels
    delays.push(delay);
  }

  return delays.join('|');
};

/**
 * combine intro/outro to the main audio file
 * @param filepath - the main audio source path
 * @param intro - the intro object contains [path, duration]
 * @param outro - the outro object contains [path, duration]
 * @param overlayDuration - the duration for main audio overlapping
 */
module.exports = (filepath = '', intro = {}, outro = {}, overlayDuration = 0) => {
  return new Promise(async (mresolve, mreject) => {
    try {
      if (isEmpty(filepath)) {
        throw new Error('Main audio file is missing');
      }

      if (isEmpty(intro) && isEmpty(outro)) {
        processingLogger.log(`Intro and outro is both not present for ${filepath}`);
        return mresolve(filepath);
      }

      const [introPath, introDuration] = intro;
      const [outroPath] = outro;
      const introOnly = !isEmpty(intro) && isEmpty(outro);
      const outroOnly = isEmpty(intro) && !isEmpty(outro);

      new ffmpeg(filepath)
        .then(async file => {
          file.addCommand('-y'); // overwrite existing
          file.addCommand('-hide_banner');

          // add them to ffmpeg command
          if (!isEmpty(introPath)) {
            file.addCommand('-i', introPath);
          }

          if (!isEmpty(outroPath)) {
            file.addCommand('-i', outroPath);
          }

          const milliseconds = file.metadata.duration.raw.split('.')[1] || 0;
          const mainFileDuration = Number(file.metadata.duration.seconds + '.' + milliseconds);

          // get fade delay for intro -> main audio transition
          // using the overlayDuration option
          const adelayFirst = await new Promise(resolve => {
            let introDelay = introDuration;

            // Delay must be non negative number.
            if (overlayDuration && introDuration > overlayDuration) {
              // have fading
              introDelay = introDuration - overlayDuration;
            }

            const delays = getDelaysForChannels(introDelay);
            resolve(delays);
          });

          // get fade delay for main audio -> outro transition
          // using the overlayDuration option
          const adelaySecond = await new Promise(resolve => {
            let outroDelay = mainFileDuration;
            if (outroOnly) {
              if (overlayDuration) {
                // have fading
                outroDelay = mainFileDuration - overlayDuration;
              }
            } else {
              // from here its when intro/outro are both present
              outroDelay = introDuration + mainFileDuration;
              if (overlayDuration) {
                // have fading
                outroDelay = introDuration + mainFileDuration - 2 * overlayDuration;
              }
            }

            const delays = getDelaysForChannels(outroDelay);
            resolve(delays);
          });

          // build the filter complex
          const filterComplex = await new Promise(resolve => {
            if (introOnly) {
              return resolve(`[0]adelay=${adelayFirst}[a];[1][a]amix=2`);
            }

            if (outroOnly) {
              return resolve(`[1]adelay=${adelaySecond}[a];[0][a]amix=2`);
            }

            // from here its when intro/outro are both present
            resolve(`[0]adelay=${adelayFirst}[a];[2]adelay=${adelaySecond}[b];[1][a][b]amix=3`);
          });

          // console.log('adelayFirst', adelayFirst);
          // console.log('adelaySecond', adelaySecond);
          // console.log('filterComplex2', filterComplex);

          file.addCommand('-filter_complex', `"${filterComplex}"`);
          file.addCommand('-q:a', '3');
          const concatPath = getConcatAudioPath(filepath);
          file.saveOriginal([
            concatPath,
            err => {
              if (err) {
                return mreject(
                  new Error(
                    `Unable to concat intro/outro to audio file ${filepath}. ${err.message}`
                  )
                );
              }

              safeUnlink(filepath); // remove main
              !isEmpty(introPath) && safeUnlink(introPath); // remove intro
              !isEmpty(outroPath) && safeUnlink(outroPath); // remove outro
              mresolve(concatPath);
            },
          ]);
        })
        .catch(err => {
          mreject(new Error(`Error loading file ${filepath} for intro/outro. ${err.message}`));
        });
    } catch (err) {
      mreject(err);
    }
  });
};
