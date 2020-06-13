'use strict';

const isEmpty = require('lodash/isEmpty');
const {
  processingLogger,
  getS3UrlEquivalent,
  getIntroAudioSavePath,
  getOutroAudioSavePath,
} = require('./utils');
const { downloadFile } = require('../../helpers/downloader');

/**
 * download the intro and outro files
 * @param intro - the intro file url
 * @param outro - the outro file url
 * @param savingrefpath - the reference file on where to save downloaded files
 */
module.exports = async (intro = '', outro = '', savingrefpath = '') => {
  const introOnly = !isEmpty(intro) && isEmpty(outro);
  const outroOnly = isEmpty(intro) && !isEmpty(outro);

  const fileUrls = await new Promise(resolve => {
    if (introOnly) {
      return resolve({ intro });
    }

    if (outroOnly) {
      return resolve({ outro });
    }

    // if both and its equal
    if (intro === outro) {
      return resolve({ intro });
    }

    resolve({ intro, outro });
  });

  return new Promise((mresolve, mreject) => {
    if (isEmpty(savingrefpath)) {
      return mreject(new Error('Saving reference path is missing'));
    }

    // if the intro and outro are the same path
    // use the same filestream
    Promise.all(
      Object.keys(fileUrls).map(filekey => {
        return new Promise(async (resolve, reject) => {
          try {
            const fileUrl = getS3UrlEquivalent(fileUrls[filekey]);
            if (isEmpty(fileUrl)) {
              return resolve();
            }

            processingLogger.log(`DOWNLOADING ${filekey} file ${fileUrl}`);
            const filepath = await downloadFile({
              fileUrl,
              savepath: fileType => {
                const savepath =
                  filekey === 'intro'
                    ? getIntroAudioSavePath(savingrefpath, fileType.ext)
                    : getOutroAudioSavePath(savingrefpath, fileType.ext);

                return savepath;
              },
            });

            processingLogger.log(`DOWNLOADED ${filekey} file to ${filepath}`);
            resolve(filepath);
          } catch (err) {
            reject(err);
          }
        });
      })
    )
      .then(files => {
        if (introOnly) {
          return mresolve([files[0], '']);
        }

        if (outroOnly) {
          return mresolve(['', files[0]]);
        }

        // if both and its equal
        if (intro === outro) {
          return mresolve([files[0], files[0]]);
        }

        mresolve(files);
      })
      .catch(err => {
        mreject(
          new Error(
            `Unable to download intro/outro file ${JSON.stringify(fileUrls)} ${err.message}`
          )
        );
      });
  });
};
