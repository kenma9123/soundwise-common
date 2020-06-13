'use strict';

const path = require('path');
const isEmpty = require('lodash/isEmpty');
const flattenDeep = require('lodash/flattenDeep');
const detectSilence = require('./detectSilence');
const { processingLogger, parseSilenceDetectInChunks } = require('./utils');
const { getPathBasename, safeUnlink } = require('../../helpers/utils');
const getRemoveAllSilencePath = spath =>
  `${getPathBasename(spath)}_silence_removed${path.extname(spath)}`;

/**
 * remove excessively long silence throughout the audio file
 * @param filepath - the file audio to process
 * @param duration - the silence duration to remove
 */
module.exports = (filepath = '', duration = 1) => {
  return new Promise(async (resolve, reject) => {
    try {
      if (isEmpty(filepath)) {
        throw new Error('Remove all silence input file is missing');
      }

      const options = { noise: -60, duration };
      const [file, args] = await detectSilence(filepath, options);
      const [err, , stdout, stderr] = args;
      if (err) {
        return reject(
          new Error(
            `Unable to read silence detect for file ${filepath} on silence periods. ${err.message}`
          )
        );
      }

      // parse from output
      const chunks = parseSilenceDetectInChunks(stdout + '\n' + stderr);
      // console.log('removeAllSilence', chunks);

      // if chunks is empty then resolve
      const flatChunks = flattenDeep(chunks);
      if (isEmpty(flatChunks[0])) {
        processingLogger.log(`No excessive silence detected for file ${filepath}`);
        return resolve(filepath);
      }

      // build trim zone based on silence chunks
      let startBuffer = 0;
      const trimzones = [];
      const sequences = [];
      chunks.forEach((silence, index) => {
        const [start, end] = silence;
        const [, startValue] = start;
        const [, endValue] = end;

        // our trimEnd is the start of silence
        let trimEnd = Number(startValue).toFixed(3);

        // our startBuffer is our trim start
        let trimStart = Number(startBuffer).toFixed(3);
        if (trimStart >= trimEnd) {
          trimEnd = Number(trimStart) + 0.001; // add microsecond
        }

        // push to trimzone
        trimzones.push([trimStart, trimEnd]);

        // create sequence
        sequences.push(`[a${index + 1}]`);

        // if we're at the end of chunks, end it with the total audio duration
        if (index === chunks.length - 1) {
          trimStart = Number(endValue).toFixed(3);
          trimEnd = file.metadata.duration.seconds + 1;

          // push to trimzone again
          trimzones.push([trimStart, trimEnd]);

          // create sequence again
          sequences.push(`[a${index + 2}]`);
        } else {
          // assign endValue as new startBuffer for next iteration
          startBuffer = endValue;
        }
      });

      // build the filter from trimzones
      const filter = [
        trimzones
          .map((zone, index) => {
            const [start, end] = zone;
            return `[0]atrim=start=${start}:end=${end}${sequences[index]}`;
          })
          .join(';'),
        sequences.map(sequence => sequence).join(''),
      ].join(';');

      // build filterComplex for ffmpeg
      const filterComplex = `"${filter}concat=n=${trimzones.length}:v=0:a=1"`;
      const silenceRemovedPath = getRemoveAllSilencePath(filepath);
      file.addCommand('-y'); // overwrite existing
      file.addCommand('-hide_banner');
      file.addCommand('-filter_complex', filterComplex);
      file.addCommand('-q:a', '3');
      file.saveOriginal([
        silenceRemovedPath,
        err => {
          if (err) {
            return reject(
              new Error(
                `Removing silence through out audio failed ${silenceRemovedPath}. ${err.message}`
              )
            );
          }

          safeUnlink(filepath); // remove original
          resolve(silenceRemovedPath);
        },
      ]);
    } catch (err) {
      reject(err);
    }
  });
};
