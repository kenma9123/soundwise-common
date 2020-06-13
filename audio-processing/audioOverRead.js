'use strict';

const isEmpty = require('lodash/isEmpty');
const detectSilence = require('./detectSilence');
/**
 * detect overread error in an audio
 * @param filepath - the file audio to detect the error
 */
module.exports = (filepath = '') => {
  return new Promise(async (resolve, reject) => {
    try {
      if (isEmpty(filepath)) {
        throw new Error('Overread input file is missing');
      }

      const [, args] = await detectSilence(filepath);
      const [err, , stdout, stderr] = args;
      if (err) {
        return reject(
          new Error(`Unable to read silence detect for file ${filepath}. ${err.message}`)
        );
      }

      // detect from output
      const ouput = stdout + '\n' + stderr;
      const overread = ouput.includes(' overread, skip ') && ouput.includes(' enddists: ');
      resolve(overread);
    } catch (err) {
      reject(err);
    }
  });
};
