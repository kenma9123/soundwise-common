'use strict';

const path = require('path');
const moment = require('moment');
const isEmpty = require('lodash/isEmpty');
const head = require('lodash/head');
const last = require('lodash/last');
const ffmpeg = require('../../common/ffmpeg');
const audioOverRead = require('./audioOverRead');
const setMP3Codec = require('./setMP3Codec');
const detectSilence = require('./detectSilence');
const { processingLogger, parseSilenceDetectInChunks } = require('./utils');
const { getPathBasename, safeUnlink } = require('../../helpers/utils');
const getTrimmedAudioPath = spath => `${getPathBasename(spath)}_trimmed${path.extname(spath)}`;

/**
 * trim of silence at the beginning and end of audio file
 * @param filepath - the audio file to process
 */
module.exports = (filepath = '') => {
  return new Promise(async (resolve, reject) => {
    try {
      if (isEmpty(filepath)) {
        throw new Error('Remove silence input file is missing');
      }

      // detect over read error first (issue/177)
      const hasOverRead = await audioOverRead(filepath);
      if (hasOverRead) {
        processingLogger.log(`OVERREAD trim detected of file ${filepath}`);

        // force convert it to mp3 codec and get the new path
        filepath = await setMP3Codec(filepath, true);
        processingLogger.log(`SOURCEPATH replaced for over read ${filepath}`);
      }

      const noise = hasOverRead ? -50 : -60;
      const [file, args] = await detectSilence(filepath, { noise });
      const [err, , stdout, stderr] = args;
      if (err) {
        return reject(
          new Error(`Unable to read silence detect for file ${filepath} on trim. ${err.message}`)
        );
      }

      // parse from output
      // expected output is [[ 'silence_start', '0' ], [ 'silence_end', '2.7402' ], [ 'silence_duration', '2.7402' ]]
      const output = parseSilenceDetectInChunks(stdout + '\n' + stderr);

      // determine start and end of trimming
      const [start, end] = await new Promise(async mresolve => {
        // get start of trim
        const start = await new Promise(sresolve => {
          const firstSilenceChunk = head(output);
          if (!isEmpty(firstSilenceChunk)) {
            const [start, end] = firstSilenceChunk;
            const [, startValue] = start;
            const [, endValue] = end;
            if (startValue > -0.2 && startValue < 0.2 && endValue) {
              // +/- 0.2 second
              const value = Number(endValue).toFixed(3);
              return sresolve(value);
            }
          }

          sresolve(0);
        });

        // get end of trim
        const end = await new Promise(sresolve => {
          // if there are multiple outputs
          if (output.length > 1) {
            // get the last occurence of silence chunks
            const lastSilenceChunk = last(output);
            if (!isEmpty(lastSilenceChunk)) {
              const [start, end] = lastSilenceChunk;
              const [, startValue] = start;
              const [, endValue] = end;
              const rawDuration = moment.duration(file.metadata.duration.raw).asSeconds();
              if (rawDuration - endValue < 0.2) {
                // gap between file duration end silence_end smaller than 0.2 second
                const value = Number(startValue).toFixed(3);
                return sresolve(value);
              }
            }
          }

          // return the total duration + 1 by default
          // if there's only 1 chunk of silence
          // or conditions not met
          sresolve(file.metadata.duration.seconds + 1);
        });

        mresolve([start, end]);
      });

      const trimmedPath = getTrimmedAudioPath(filepath);
      new ffmpeg(filepath)
        .then(audio => {
          audio.addCommand('-y'); // overwrite existing
          audio.addCommand('-hide_banner');
          audio.addCommand('-af', `atrim=${start}:${end}`);
          audio.addCommand('-q:a', '3');
          audio.saveOriginal([
            trimmedPath,
            err => {
              if (err) {
                return reject(new Error(`Unable to trim audio file ${filepath}. ${err.message}`));
              }

              safeUnlink(filepath); // remove original
              resolve(trimmedPath);
            },
          ]);
        })
        .catch(err => {
          reject(new Error(`Error loading file ${filepath} for trim. ${err.message}`));
        });
    } catch (err) {
      reject(err);
    }
  });
};
