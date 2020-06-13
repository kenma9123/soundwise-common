'use strict';

const isEmpty = require('lodash/isEmpty');
const ffmpeg = require('../../common/ffmpeg');
const { trimText, getPathBasename, safeUnlink } = require('../../helpers/utils');
const getCoverResizedPath = spath => `${getPathBasename(spath)}_resized.png`;
const getAudioTaggingPath = spath => `${getPathBasename(spath)}_tagging.mp3`;

/**
 * add metadata tags to the episode audio file
 * @param filepath - the audio file to process
 * @param coverImagePath - the cover image for the audio
 * @param imageSize - the cover image size
 */
module.exports = (filepath = '', coverImagePath = '', coverImageSize = {}) => {
  return new Promise(async (resolve, reject) => {
    try {
      if (isEmpty(filepath)) {
        throw new Error('Audio tagging input file is missing');
      }

      if (isEmpty(coverImagePath)) {
        throw new Error('Audio tagging cover image file is missing');
      }

      if (isEmpty(coverImageSize)) {
        throw new Error('Audio tagging cover image size is missing');
      }

      // load the audio file on where to attach the cover image
      const file = await new Promise((resolve, reject) => {
        new ffmpeg(filepath).then(resolve).catch(err => {
          reject(new Error(`Error loading file ${filepath} for audio tagging. ${err.message}`));
        });
      });

      // get the cover image
      const finalCoverImagePath = await new Promise((resolve, reject) => {
        // if size is too large, we have to resize it
        const { height = 0, width = 0 } = coverImageSize;
        if (height > 300 || width > 300) {
          const resizedPath = getCoverResizedPath(coverImagePath);
          new ffmpeg(coverImagePath)
            .then(image => {
              // ffmpeg -i img.png -vf scale=300:300 img_updated.png
              image.addCommand('-y'); // overwrite existing
              image.addCommand('-hide_banner');
              image.addCommand('-vf', `scale=300:300`);
              image.saveOriginal([
                resizedPath,
                err => {
                  if (err) {
                    return reject(
                      new Error(
                        `Unable to resize cover image file ${coverImagePath} for audio tagging. ${err.message}`
                      )
                    );
                  }

                  safeUnlink(coverImagePath); // removing original image file
                  resolve(resizedPath);
                },
              ]);
            })
            .catch(err => {
              reject(
                new Error(`Error loading cover image ${filepath} for audio tagging. ${err.message}`)
              );
            });
        } else {
          resolve(coverImagePath);
        }
      });

      // start the tagging process
      // from https://stackoverflow.com/questions/18710992/how-to-add-album-art-with-ffmpeg
      // ffmpeg -i in.mp3 -i test.jpeg -map 0:0 -map 1:0 -c copy -id3v2_version 3 -metadata:s:v title="Album cover" -metadata:s:v comment="Cover (front)" out.mp3
      const audioTaggingPath = getAudioTaggingPath(filepath);
      file.addCommand('-i', finalCoverImagePath);
      file.addCommand('-map', '0:0');
      file.addCommand('-map', '1:0');
      file.addCommand('-codec', 'copy');
      file.addCommand('-id3v2_version', '3');
      file.addCommand('-metadata:s:v', `title="Album cover"`);
      file.addCommand('-metadata:s:v', `comment="Cover (front)"`);
      const titleEscaped = trimText(title); // remove newlines, from https://stackoverflow.com/a/10805292/2154075
      const artistEscaped = trimText(artist); // remove newlines
      file.addCommand('-metadata', `title="${titleEscaped}"`);
      if (typeof track === 'number') {
        file.addCommand('-metadata', `track="${track}"`);
      }
      file.addCommand('-metadata', `artist="${artistEscaped}"`);
      file.addCommand('-metadata', `album="${titleEscaped}"`);
      file.addCommand('-metadata', `year="${new Date().getFullYear()}"`);
      file.addCommand('-metadata', `genre="Podcast"`);
      file.saveOriginal([
        audioTaggingPath,
        err => {
          if (err) {
            return reject(
              new Error(`Unable to tag cover to audio file ${audioTaggingPath}. ${err.message}`)
            );
          }

          safeUnlink(filepath); // remove original
          resolve(audioTaggingPath);
        },
      ]);
    } catch (err) {
      reject(err);
    }
  });
};
