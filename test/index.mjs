import express from 'express';
import * as sri2db from '../src/lib/client.js';
import pg from 'pg-promise';
import mssql from 'mssql';
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
  const apiConfigBase = {
    baseUrl: 'http://localhost:22222',
    // path: '/a',
    headers: {},
    limit: 3,
  };
  const singleConfigPostgresBase = {
    api: apiConfigBase,
    db: {
      type: 'postgres',
      host: 'localhost',
      port: 25432,
      ssl: false,
      database: 'postgres',
      schema: 'public',
      // table: 'sri2db_large',
      username: 'postgres',
      password: 'postgres',
      connectionTimeout: 2000,
    },
    syncMethod: 'fullSync',
  };

  const singleConfigMssqlBase = {
    api: apiConfigBase,
    db: {
      type: 'mssql',
      host: 'localhost',
      port: 21433,
      database: 'db',
      schema: 'dbo',
      username: 'sa',
      password: 'p@ssw0rd',
      ssl: false,
      // table: 'sri2db_large',
      connectionTimeout: 2000,
      options: {
        trustServerCertificate: true // tedious config option trustServerCertificate defaults to false if not supplied since mssql 7.x
      }
    },
    syncMethod: 'fullSync',
  };

  let fakeApiServer;
  const pgp = pg({ schema: singleConfigPostgresBase.db.schema });
  const postgresdb = pgp({ ...singleConfigPostgresBase.db, user: singleConfigPostgresBase.db.username });
  const mssqlconfig = {
    server: singleConfigMssqlBase.db.host,
    database: singleConfigMssqlBase.db.database,
    port: singleConfigMssqlBase.db.port || 1433,
    user: singleConfigMssqlBase.db.username,
    password: singleConfigMssqlBase.db.password,
    pool: {
      max: 2,
      min: 0,
      idleTimeoutMillis: singleConfigMssqlBase.db.idleTimeout || 2000,
    },
    connectionTimeout: singleConfigMssqlBase.db.connectionTimeout || 2000,
    requestTimeout: singleConfigMssqlBase.db.queryTimeout || 2000,
    options: {
      trustServerCertificate: true // tedious config option trustServerCertificate defaults to false if not supplied since mssql 7.x
    }
  };

  let mssqldb;

  // let connection;

  // eslint-disable-next-line no-undef
  before(async () => {
    const fakeApi = express();
    fakeApi.use(fakeApiHandler);
    fakeApiServer = fakeApi.listen(22222);

    // connection = await db.connect();
    mssqldb = await mssql.connect(mssqlconfig);
  });

  // eslint-disable-next-line no-undef
  after(async () => {
    console.log('closing the fake Api server');
    fakeApiServer.close();

    console.log('closing pg-promise');
    await pgp.end();

    console.log('closing mssql');
    await mssql.close();

    console.log('All tests done');
  });

  describe('POSTGRES', () => {
    it('should work', async () => {
      /** @typedef { import('../src/lib/client.js').TSri2DbConfig } TSri2DbConfig */

      /** @type {TSri2DbConfig} */
      const singleConfig = {
        ...singleConfigPostgresBase,
        api: {
          ...singleConfigPostgresBase.api,
          path: '/a',
        },
        db: {
          ...singleConfigPostgresBase.db,
          table: 'sri2db_large',
        },
        syncMethod: 'fullSync',
      };

      const sri2DBInstance = sri2db.Sri2Db(singleConfig);
      await sri2DBInstance.configuredSync();

      assert.equal(
        (await postgresdb.one('select count(*) from sri2db_synctimes')).count,
        1,
      );

      // after the sync, we should check if the database contains whatever we think should be in the database
      assert.equal(
        (await postgresdb.one('select count(*) from sri2db_large')).count,
        10,
        'nr of resources did not match',
      );
    });
  });

  describe('MSSQL', () => {
    it('should work', async () => {
      /** @typedef { import('../src/lib/client.js').TSri2DbConfig } TSri2DbConfig */

      /** @type {TSri2DbConfig} */
      const singleConfig = {
        ...singleConfigMssqlBase,
        api: {
          ...singleConfigMssqlBase.api,
          path: '/a',
        },
        db: {
          ...singleConfigMssqlBase.db,
          table: 'sri2db_large',
          options: {
            trustServerCertificate: true // tedious config option trustServerCertificate defaults to false if not supplied since mssql 7.x
          },
        },
        syncMethod: 'fullSync',
      };

      const sri2DBInstance = sri2db.Sri2Db(singleConfig);
      await sri2DBInstance.configuredSync();

      assert.equal(
        (await mssqldb.request().query('select count(*) as count from sri2db_synctimes')).recordset[0].count,
        1,
      );

      // after the sync, we should check if the database contains whatever we think should be in the database
      assert.equal(
        (await (mssqldb.request().query('select count(*) as count from sri2db_large'))).recordset[0].count,
        10,
        'nr of resources did not match',
      );
    });
  });
});
