'use strict';

const moment = require('moment');
const isEmpty = require('lodash/isEmpty');
const isNull = require('lodash/isNull');
const isString = require('lodash/isString');
const isBoolean = require('lodash/isBoolean');

const episodeSchema = {
  actionstep: { read: true, type: 'string' },
  audioProcessing: { read: false },
  coverArtUrl: { read: true, type: 'string' },
  creatorId: { read: true, from: 'creatorID', type: 'string' },
  createdAt: { read: true, from: 'date_created', type: 'date' },
  description: { read: true, type: 'string' },
  duration: { read: true, type: 'int' },
  episodeState: { read: false },
  id3Tagged: { read: true, type: 'boolean' },
  index: { read: true, type: 'int' },
  published: { read: true, from: 'isPublished', type: 'boolean' },
  lastLiked: { read: true, type: 'string' },
  likesCount: { read: true, type: 'int' },
  notes: { read: true, type: 'string' },
  publicEpisode: { read: true, type: 'boolean' },
  publishedAt: { read: true, from: 'date_published', orfrom: 'date_created', type: 'date' },
  publisherId: { read: true, from: 'publisherID', type: 'string' },
  publishOn: { read: false },
  releaseInterval: { read: true, type: 'int' },
  soundcastId: { read: true, from: 'soundcastID', type: 'string' },
  title: { read: true, type: 'string' },
  totalListens: { read: true, type: 'int' },
  url: { read: true, type: 'string' },
};

const castValueFromType = (type, value = null) => {
  switch (type) {
    case 'int':
      return value ? Number(value) : 0;
    case 'boolean':
      if (isBoolean(value)) {
        return value;
      }

      if (isString(value)) {
        if (value === 'true') {
          return true;
        } else if (value === 'false') {
          return false;
        }
      }

      return !isEmpty(value);
    case 'date':
      return value ? moment.unix(Number(value)).format() : null;
    case 'string':
    default:
      return !isEmpty(value) ? `${value}` : '';
  }
};

/**
 * extract episode data based from schema
 * @param snapshot - the episode firebase snapshot
 * @param raw = determine if the snapshot is raw episode object
 */
const extractEpisodeData = (snapshot, raw = false) => {
  if (!raw && !snapshot.exists()) {
    return {};
  }

  const episode = raw ? snapshot : snapshot.val();
  const result = Object.keys(episodeSchema).reduce((prev, key) => {
    const { read = false, from = '', orfrom = '', type = 'string' } = episodeSchema[key];

    if (read) {
      const skey = !isEmpty(from) ? from : key;
      prev[key] = skey in episode ? episode[skey] : null;

      // use orfrom if value is null
      if (isNull(prev[key]) && !isEmpty(orfrom)) {
        prev[key] = orfrom in episode ? episode[orfrom] : null;
      }

      prev[key] = castValueFromType(type, prev[key]);
    }

    return prev;
  }, {});

  // attach episodeId
  return {
    episodeId: raw ? snapshot.episodeId : snapshot.key,
    ...result,
  };
};

/**
 * Convert direct object of firebase data to postgre equivalent
 * @param {*} object - the raw firebase object
 */
const convertFirebaseObjToPostgres = (object = {}) => {
  return extractEpisodeData(object, true);
};

module.exports = {
  extractEpisodeData,
  convertFirebaseObjToPostgres,
};
