/* eslint-disable max-len */
/** **********************
 *   HELPER FUNCTIONS    *
 *********************** */

const clonedeep = require('lodash.clonedeep');

/**
 * This function MODIFIES the object!!!
 *
 * @param {Record<string,unknown>} obj
 * @returns {Record<string,unknown>}
 */
const removeDollarFields = (obj) => {
  Object.keys(obj).forEach((property) => {
    if (property.startsWith('$$') && property !== '$$meta') {
      // eslint-disable-next-line no-param-reassign
      delete obj[property];
    } else if (obj[property] !== null && typeof obj[property] === 'object') {
      // @ts-ignore
      removeDollarFields(obj[property]);
    }
  });
  return obj;
};

/**
 * Helper function to compute a hash code from a string as found here:
 *  https://stackoverflow.com/a/7616484
 */
function hashCode(theString) {
  let hash = 0;
  let chr;
  if (theString.length === 0) return hash;
  for (let i = 0; i < theString.length; i++) {
    chr = theString.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    // eslint-disable-next-line no-bitwise
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
}

/**
 * This function will make a few fixes to old api's that weren't fully compliant
 * to make sure the assumptions we make later on in the code will be valid.
 *
 * For example:
 *  * if a resource doesn't have a key, then we generate a key from the permalink
 *  * if a resource doesn't have $$meta.modified, then we'll add a default date in there
 *
 * @param {object} r
 */
function fixResourceForStoring(r) {
  if (r.$$meta && r.$$meta.modified && r.key) {
    return r;
  }
  const retVal = clonedeep(r);
  if (!(r.$$meta && r.$$meta.modified)) {
    retVal.$$meta.modified = new Date().toISOString();
  }
  if (!r.key && r.$$meta && r.$$meta.permalink) {
    retVal.key = r.$$meta.permalink.substring(r.$$meta.permalink.lastIndexOf('/') + 1);
  }
  return retVal;
}


/**
 * Either adds expand= to the url or replaces the existing expand= with
 * the given expansion
 * @param {*} path
 * @param {*} expansion
 */
function setExpandOnPath(path, expansion) {
  if (path.includes('?') && path.includes('expand=')) {
    return path.replace(/expand=[^&$]*/, `expand=${expansion}`);
  }

  return `${path}${path.includes('?') ? '&' : '?'}expand=${expansion}`;
}

/**
 * @param {number} milliseconds
 * @param {String} unit can be ms, s, m, h, d
 */
const msToOtherUnit = (milliseconds, unit) => {
  let elapsedInUnit;
  switch (unit) {
    case 'ms': elapsedInUnit = milliseconds; break;
    case 's': elapsedInUnit = milliseconds / 1000; break;
    case 'm': elapsedInUnit = milliseconds / 1000 / 60; break;
    case 'h': elapsedInUnit = milliseconds / 1000 / 60 / 60; break;
    case 'd': elapsedInUnit = milliseconds / 1000 / 60 / 60 / 24; break;
    default: elapsedInUnit = milliseconds; break;
  }
  return elapsedInUnit;
};

/**
 * elapsedTimeCalculations calculates the elapsedMilliseconds given
 *
 * @param {number} startDate obtained with a Date.now() call (nr of mssince Unix epoch)
 * @param {'ms' | 's' | 'm' | 'h' | 'd'} unit can be ms, s, m, h, d
 * @param {number | false} amount [optional] if present will add avg per second/minute/hour
 * @param {string | false} avgUnit [optional] if not set, same unit as above, but you can make it avg per m, h, d, ... if you want
 * @param {number} endDate [optional] obtained with a Date.now() call, if missing this function will do a Date.now() call for you
 * @returns {{ unit: string, amount, avgUnit, startDate, endDate }}
 */
const elapsedTimeCalculations = (startDate, unit = 'ms', amount = false, avgUnit = false, endDate = Date.now()) => {
  // eslint-disable-next-line no-param-reassign
  if (!avgUnit) avgUnit = unit;
  const retVal = {
    unit, amount, avgUnit, startDate, endDate,
  };
  retVal.elapsedMilliseconds = (endDate - startDate);
  retVal.elapsedInUnit = msToOtherUnit(retVal.elapsedMilliseconds, unit);
  retVal.elapsedInAvgUnit = msToOtherUnit(retVal.elapsedMilliseconds, avgUnit);
  retVal.avgPerAvgUnit = amount ? Math.round(amount / retVal.elapsedInAvgUnit) : null;
  return retVal;
};

const elapsedTimeCalculationsToString = (calc) => {
  const avgPerSecondPart = calc.avgPerAvgUnit ? ` (${calc.avgPerAvgUnit}/${calc.avgUnit})` : '';
  return `${Math.round(calc.elapsedInUnit * 100) / 100}${calc.unit}${avgPerSecondPart}`;
};

/**
 *
 * @param {number} startDate
 * @param {'ms' | 's' | 'm' | 'h' | 'd'} unit can be ms, s, m, h, d
 * @param {number | false} amount [optional] if present will add avg per second/minute/hour
 * @param {string | false} avgUnit [optional] if not set, same unit as above, but you can make it avg per m, h, d, ... if you want
 */
const elapsedTimeString = (startDate, unit = 'ms', amount = false, avgUnit = false, endDate = Date.now()) => {
  const calc = elapsedTimeCalculations(startDate, unit, amount, avgUnit, endDate);
  return elapsedTimeCalculationsToString(calc);
};

/**
 * Translates the API response to an array of either resources, or just hrefs
 * (if no $$expanded available due to ?expand=NONE for example)
 *
 * We also try to make it smart enough to handle an array that returns a plain array
 * (like security api query interface)
 *
 * @param {Array<unknown> | { results: Array<unknown>}} jsonData
 * @returns {Array<Record<string,unknown> | string>}
 */
const translateApiResponseToArrayOfResources = (jsonData) => {
  let results;
  if (Array.isArray(jsonData)) {
    results = jsonData;
  } else if (jsonData && jsonData.results && Array.isArray(jsonData.results)) {
    results = jsonData.results;
  }

  if (results.length === 0) {
    return [];
  }
  if (results[0].$$expanded) {
    return results.map(r => r.$$expanded);
  }
  if (results[0].href) {
    return results.map(r => r.href);
  // } else if (results[0].person && typeof results[0].person === 'string') {
  //  jsonData.map(r => r.person);
  }
  return results;
};

async function sleep(timeout) {
  return new Promise((resolve, reject) => setTimeout(() => resolve(true), timeout));
}

module.exports = {
  sleep,
  removeDollarFields,
  hashCode,
  fixResourceForStoring,
  setExpandOnPath,
  msToOtherUnit,
  elapsedTimeCalculations,
  elapsedTimeCalculationsToString,
  elapsedTimeString,
  translateApiResponseToArrayOfResources,
};
