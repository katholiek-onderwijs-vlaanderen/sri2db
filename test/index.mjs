import express from 'express';
import * as sri2db from '../src/lib/client.js';
import pg from 'pg-promise';
import chai from 'chai';
const { assert } = chai;

/**
 * Generator function to generate a range between 2 numbers
 * (including from and to, preferably integers).
 *
 * @example range(1,3) => [1, 2, 3]
 *
 * @param {number} from: the smallest number
 * @param {number} to: the biggest number
 */
function* range(from, to) {
  for (let i = from; i <= to; i++) {
    yield i;
  }
}

function generateApiRecord(path, key) {
  // const [ ...prefix, key ] = path.split(',');
  return { $$meta: { type: path.replace('/', '_').toUpperCase(), permalink: `${path}/${key}` }, key, name: `Name of resource ${path}` };
}

/**
 * group an array by a number of elements
 */
const groupByN = (inputArray, n) => {
  const result = [];
  for (let i = 0; i < inputArray.length; i += n) {
    result.push(inputArray.slice(i, i + n));
  }
  return result;
};

/* @type {import('express')} */
function fakeApiHandler(req, resp, _next) {
  const generatePageLink = (index, total) => {
    switch (index) {
      case total: return undefined;
      case 0: return `${apiPath}?limit=${limit}&expand=FULL`;
      default: break;
    }
    return `${apiPath}?offset=${index * limit}&limit=${limit}&expand=FULL`;
  };

  const apiPath = '/a';
  const aResourcesEntries = Array.from(range(1, 10))
    .map((i) => generateApiRecord(apiPath, i))
    .map((r) => [r.$$meta.permalink, r]);

  const limit = 3;
  const aListResourceEntries = groupByN(aResourcesEntries, limit)
    .map((group, index, completeArray) => {
      return {
        $$meta: {
          current: generatePageLink(index, completeArray.length),
          next: generatePageLink(index + 1, completeArray.length),
        },
        results: group.map(([k, v]) => ({ href: k, $$expanded: v })),
      };
    })
    .map((r) => [r.$$meta.current, r]);

  const myGetMap = {
    ...Object.fromEntries(aResourcesEntries),
    ...Object.fromEntries(aListResourceEntries),
  };

  // console.log(myGetMap[req.originalUrl]);
  resp.type('json');
  resp.end(JSON.stringify(myGetMap[req.originalUrl], null, 2));
  // console.log(myGetMap);
}


// eslint-disable-next-line no-undef
describe('sri2db test suite', () => {
  let fakeApiServer;

  // eslint-disable-next-line no-undef
  before(() => {
    const fakeApi = express();
    fakeApi.use(fakeApiHandler);
    fakeApiServer = fakeApi.listen(22222);
  });

  // eslint-disable-next-line no-undef
  after(() => {
    console.log('closing the fake Api server');
    fakeApiServer.close();
    // process.exit();
  });
  

  it('should work', async () => {
    // TODO
    // const response = await fetch('http://localhost:22222/a/1');
    // const data = await response.json();
    // console.log('received from api', data);

    // const response2 = await fetch('http://localhost:22222/a?offset=0&limit=3');
    // const data2 = await response2.json();
    // console.log('received from api', data2);

    /** @typedef { import('../src/lib/client.mjs').TSri2DbConfig } TSri2DbConfig */

    /** @type {TSri2DbConfig} */
    const singleConfig = {
      api: {
        baseUrl: 'http://localhost:22222',
        path: '/a',
        headers: {},
        limit: 3,
      },
      db: {
        type: 'postgres',
        host: 'localhost',
        port: '25432',
        database: 'postgres',
        schema: 'public',
        table: 'sri2db_large',
        username: 'postgres',
        password: 'postgres',
      },
      syncMethod: 'fullSync',
    };

    const sri2DBInstance = sri2db.Sri2Db(singleConfig);
    await sri2DBInstance.configuredSync();

    // after the sync, we should check if the database contains whatever we think should be in the database
    const pgp = pg({ schema: singleConfig.db.schema });
    const db = pgp({ ...singleConfig.db, user: singleConfig.db.username });
    const connection = await db.connect();
    const queryResult = await connection.result('select count(*) from sri2db_large');
    assert.equal(queryResult.rows[0].count, 10, 'nr of resources did not match');
  });
});
