# sri2db

This is a CLI tool & nodejs module to sync any SRI interface to a database table in a postgres 9.4 or up instance or to a somewhat recent MSSQL instance.
The SRI specification can [be found here](https://github.com/katholiek-onderwijs-vlaanderen/sri).
There is also a library called [sri4node](https://github.com/katholiek-onderwijs-vlaanderen/sri) that will help you to build sri-compliant API's in nodejs with a Postgres backend.


# Installing

Installation is simple using npm :

    $ npm install github:katholiek-onderwijs-vlaanderen/sri2db


# About

The main idea of this module is to read all resources from an API and store them into a database in json(b) format. (A resource is basically a json object with attributes, like a school or a file or maybe a car.)

The database tables are not created for you, you need to set them up first (table layout is explained below).

It contains both a command-line tool, and a library to use in your own code.

# CLI Usage

The easiest way should be to install it globally:

    $ npm install -g https://github.com/katholiek-onderwijs-vlaanderen/sri2db

Then you need to create a myconfig.js file that exports a valid config object:
```
module.exports = { 
  concurrency: 1, // how many sync jobs are allowed to run at the same time
  baseConfig: { ... see blow for more details ... }
}
```
The config object should either be a config object for Sri2Db or for Sri2DbMulti as explained below. The cli tool is smart enough to figure out whether it's a configuration for a single API, or for multiple API's.

After that the tool can be run like this:

    $ sri2db --config myconfig.js

Or if you want to force another sync type than the configuredSync as indicated in the config file.

    $ sri2db --config myconfig.js --synctype fullSync

Maybe you have also configured a broadcast url (to listen for updates about resources). If you want the cli tool to connect to this server and keep listening, you can use the following syntax.
(Setting synctype to none makes sure you only listen instead of executing the configuredSync at the very beginning.)

    $ sri2db --config myconfig.js --synctype none --listen


# NodeJS Usage

Start by requiring the module in your code. 
    
```
const { Sri2Db, Sri2DbMulti } = require('sri2db');
```

## Sri2Db

Sri2Db is the base, that allows you to sync a single API endpoint to a database table.

You will need to configure which api and which database through a config file:

```
const sri2dbConfig = {
    syncMethod: 'fullSync' | 'deltaSync' | 'safeDeltaSync', // to define the sync that will be executed when calling client.configuredSync()
    dryRun: false, // true would rollback transactions to simply check if it all works
    broadcastUrl: 'https://some-broadcast-api.herokuapp.com/', // if you want to trigger delta syncs based on live updates via socket.io
    broadcastSocketIoVersion: '4', // default = '2', but if you need to use a newer socket.io client version it can also be set it to '4'
    broadcastSyncMethod: 'deltaSync', //deltaSync by default, but if you want to trigger another sync method for example a safeDeltaSync when a resource gets updated, you can configure it here
    api: {
        baseUrl: 'https://api.my.org',
        path: '/persons', //could also be /persons?gender=FEMALE if you only want to sync part of a list
        limit: 2500,
        //nextLinksBroken: true, //false by default but workaround with limit & offset if for some reason they don't work reliably
        //deletedNotImplemented: true //false by default but skips sync of deleted for deltaSync (only needed for broken sri API's)

        // cfr. https://github.com/katholiek-onderwijs-vlaanderen/sri-client#generic-interface
        // for other options to control how the api is accessed
        username: 'userthatcanreadallresources', // can be omitted if API is public
        password: 'secret',                      // can be omitted if API is public
        //headers: {}, //configure extra http headers if necessary
        timeout: 30000,
        retry: {
            retries: 1,
            initialWait: 2000,
            // factor: 3,
        },
    },
    db: {
        type: 'pg', // mssql also supported
        host: 'ec2-something.eu-west-1.compute.amazonaws.com',
        port: '5432',
        database: 'dbname',
        schema: 'public',
        table: 'persons',
        username: 'dbusername',
        password: 'dbsecretpassword',
        ssl: true,
        connectionTimeout: 60 * 1000, // default 1 minute (in milliseconds)
        idleTimeout: 60 * 1000, // default 1 minute (in milliseconds)
        queryTimeout: 60 * 60 * 1000,  // default 1 hour (in milliseconds)
        maxBulkSize: 20000, // [defaul = 10000] in case you get more records in one go from the API, they will be inserted in bulks of the given size (we experienced an out-of-mem on the database once, and we think this *might* help with huge bulk sizes)
        preferUpdatesOverInserts: false, // [default = false for postgres, true for mssql] (currently for full sync only) first delete all rows, and then insert them again, instead of only deleting rows that don't exist anymore, and updating the already existing rows afterwards
    },
}

const client = Sri2Db(sri2dbConfig);
```

Now we are ready to start syncing resources.


### Function Definitions

Below is a description of the different types of functions that you can use.
It describes the inputs and outputs of the different functions.
Most of these functions are async (returning a Promise).


You can do a full sync:

```
nrOfSyncedRecords = await client.fullSync();
```

Or a delta sync, taking all modifications starting from the latest known sync date (using a safety overlap):

```
nrOfSyncedRecords = await client.deltaSync();
```

By calling this on a regular basis, it should be quite easy to stay in sync like every minute or so.

```
setInterval(client.deltaSync, 60000)
```

**'Safer' delta syncs**: by taking all modifications starting from the latest known modified date,
you should theoretically always be in sync with the API, but care has to be taken **if you are only
syncing a subset of an API** (like /persons?gender=FEMALE), as it comes with its own set of specific problems:
 * even though a resource is not deleted but only updated, that update might have caused it to disappear from the list. In our example: when a person's gender is updated, it will not be a part of /persons?gender=FEMALE anymore. This is hard to detect if the delta sync only listens to 'updates' and 'deletes' 
 * in some very specific cases, a record might have to disappear from a list because of a change in *another* resource. For example /persons?hasFemaleFriends=true might yield different results because of a gender change in another person that is not even a part of this list.

It depends on your use-case if this information is very important. If you just want to have the latest version of a bunch of resources, and you don't care if your db contains a few unnecessary items, you should be ok with a simple delta-sync, trusting that a full-sync from time to time will clean up these unneeded records. However, if your application must know at all times which resources are and whch are not part of the list, the delta sync should be a bit more advanced. Mind you: there is a price to pay: both on the load on the API's as on the load on your own database, so you should probably only do this when it is important for your use-case.

The safeDeltaSync method will also make sure that all resources that are not a part of a filtered list anymore are also removed from your DB, and the ones that have become part of the list now because of a change in another resource will be added. [NOT IMPLEMENTED YET]

```
nrOfSyncedRecords = await client.safeDeltaSync();
```


*getLastSyncDates(syncType)* will return an object with 2 properties for the given syncType (DELTA, SAFEDELTA, FULL):
 * syncStart: the point in time the last known succesful sync started measured by the client machine that was running Sri2DB (expressed as the number of milliseconds since 1970-01-01 00:00:00 UTC (Unix Epoch))
 * lastModified: the next point in time that should be used (calculated conservatively) as a safe value for modifiedSince (expressed as the number of milliseconds since 1970-01-01 00:00:00 UTC (Unix Epoch)) 

Nevertheless: doing full syncs from time to time, or nightly syncs that sync everything from the last week or even the last month are always a good strategy.

If you want to know the date that will be used to send to the API (?modifiedSince=...) on the next run, you can call:
```
// first call will take it from the DB, after that it will be the internally calculated date
const { syncStart, lastModified } = client.getLastSyncDates();
```

You can also do a delta sync taking all modifications starting from a given point in time:

```
nrOfSyncedRecords = await client.deltaSync('2019-07-16T07:44:00Z');
```

But be aware that in this case the syncStart and lastModified will not be updated.

A delta sync will return immediately with a return value of 0 if another one is still running!


If you've configured the broadcast url, you can also start the listener, which will do a new delta sync (or the sync you've configured in broadcastSyncMethod) anytime it gets a message:

```
client.installBroadCastListeners();
```




## Sri2DbMulti

Sri2DbMulti is building on top of Sri2Db to provide an easier way to sync multiple API endpoints into a database table.
In the background it instantiates multiple Sri2Db clients each with their own configuration.

You will need to configure which api and which database through a config file:

```
const sri2dbMultiConfig = {
    baseConfig: {
        ... //same as Sri2DConfig
    },
    overwrites: [
        // a list of partial objects that only specify the properties that need to be overridden for that client
        {
            syncMethod: "fullSync", //even if the baseConfig says do a deltaSync, specificy that this API has to do a fullSync (when calling configuredSync)
            api: {
                path: '/organisations', //this instance will sync the organisations API
            }
        },
        {
            syncMethod: "fullSync", //even if the baseConfig says do a deltaSync, specificy that this API has to do a fullSync (when calling configuredSync)
            api: {
                path: '/subjects', //this instance will sync the subjects API
            },
            db: {
                table: 'subjects_apisync_table' // we'll sync this api to a different database table
            }
        },
    },
    concurrency: 1 // if you want, you can allow multiple syncs to run in parallel
}

const multiClient = Sri2DbMulti(sri2dbMultiConfig);
```

### Function Definitions

You can call all the same functions as on a simple client: configuredSync (will run the configured syncMethod for each instance), but also fullSync, deltaSync and safeDeltaSync.
```
const results = await multiClient.configuredSync();
```

and the results will have the following structure:
```
[
    { isFulfilled: true, isRejected: false, value: 4 }, // if the promise resolved
    { isFulfilled: false, isRejected: true, reason: <Error object> }, // if the promise got rejected
]
```
so you'll always know exactly which syncs have run correctly and which syncs haven't.

## Database table layout

Sri2db assumes that the schema.table you set in config has a specific set of columns (and column names)

Next to that, a table named sri2db_synctimes will be created to keep track of the last sync times,
in order to make sure that calling deltaSync and safeDeltaSync will automatically use a &modifiedSince=...
parameter that makes sense. These values are updated in a very conservative way whithout making
assumptions about the clocks of the client and database and the API being in sync. The only assumption
being made is that the clock speed of the client machine and the API will not be off by more than 1%.

### Postgres

    CREATE TABLE sri2db_table (href varchar, jsondata jsonb, modified timestamptz, key varchar, resourcetype varchar, path varchar, baseurl varchar);

    /* at the very least, create an unique index on href, but if you have path and baseurl in the table the index should contain these fields too */
    CREATE UNIQUE INDEX sri2db_table_baseurl_path_href_idx ON sri2db_table (baseurl, path, href);
    -- or if no baseurl colomn
    CREATE UNIQUE INDEX sri2db_table_path_href_idx ON sri2db_table (path, href);
    -- or if no baseurl and no path column
    CREATE UNIQUE INDEX sri2db_table_href_idx ON sri2db_table (href);

    /* [DEPRECATED] and to quickly get the last sync date, a similar index on modified would also make sense */
    CREATE INDEX sri2db_table_baseurl_path_modified_idx ON sri2db_table (baseurl, path, modified);
    -- or if no baseurl colomn
    CREATE INDEX sri2db_table_path_modified_idx ON sri2db_table (path, modified);
    -- or if no baseurl and no path column
    CREATE INDEX sri2db_table_modified_idx ON sri2db_table (modified);

 * the 'key' column can also be of type uuid, but in case the key is not a uuid varchar would be a safer bet.
 * the 'resourcetype' column is optional
 * the 'path' column is optional but necessary if you want to store multiple paths (/persons and /organisationalunits) in the same table (multiple sri2db configs writing to the same table)
 * the 'baseurl' column is optional but necessary if you want to store records from multiple baseurls (https://api.aaa.com and https://api.bbbbb.com) in the same table (multiple sri2db configs writing to the same table)
 * In all honesty: the 'key' column could easily be made optional too, but I haven't done so yet.


### MSSQL

    CREATE TABLE sri2db_table (href varchar(1024) NOT NULL, jsondata nvarchar(MAX), modified datetime NOT NULL, [key] varchar(100) NOT NULL, /*resourcetype varchar(100) NOT NULL,*/ path varchar(1024) NOT NULL, baseurl varchar(1024) NOT NULL);

    /* create 2 unique indexes (1 of them clustered) on href, but if you have path and baseurl in the table the index should contain these fields too */
    CREATE UNIQUE clustered INDEX sri2db_table_baseurl_path_href_cidx ON sri2db_table (href, path, baseurl) with (data_compression = page);
    CREATE UNIQUE           INDEX sri2db_table_baseurl_path_href_idx ON sri2db_table (href, path, baseurl) with (data_compression = page);
    -- or if no baseurl colomn
    CREATE UNIQUE clustered INDEX sri2db_table_baseurl_path_href_cidx ON sri2db_table (href, path) with (data_compression = page);
    CREATE UNIQUE           INDEX sri2db_table_baseurl_path_href_idx ON sri2db_table (href, path) with (data_compression = page);
    -- or if no baseurl and no path column
    CREATE UNIQUE clustered INDEX sri2db_table_baseurl_path_href_cidx ON sri2db_table (href) with (data_compression = page);
    CREATE UNIQUE           INDEX sri2db_table_baseurl_path_href_idx ON sri2db_table (href) with (data_compression = page);


 * the 'key' column can also be uuid, but in case the key is not a uuid varchar would be a safer bet.
 * the 'resourcetype' column is optional
 * the 'path' column is optional but necessary if you want to store multiple paths (/persons and /organisationalunits) in the same table (multiple sri2db configs writing to the same table)
 * the 'baseurl' column is optional but necessary if you want to store records from multiple baseurls (https://api.aaa.com and https://api.bbbbb.com) in the same table (multiple sri2db configs writing to the same table)
 * In all honesty: the 'key' column could easily be made optional too, but I haven't done so yet.


# Contributing

## Tests THE NEXT PART IS OBSOLETE AS THE TESTS HAVE NOT BEEN UPDATED YET

In order to run tests locally it is needed to install postgres 9.4 or superior in your machine.
see http://stackoverflow.com/a/29415300

Then you will need a user and pass for accessing your local postgres database
see also http://www.cyberciti.biz/faq/howto-add-postgresql-user-account/

We use mocha for testing. You will find a config.json file in test folder:

    {
      "baseApiUrl" : "http://dump.getpostman.com",
      "functionApiUrl" : "/status",
      "dbUser": "admin",
      "dbPassword": "admin",
      "database": "postgres",
      "dbPort": "5432",
      "dbHost": "localhost",
      "dbSsl": false
    }

All postgres related test takes its configuration from that file. So make sure it is corrected full filled.

After that you are available to run test doing:

    $ cd [your_project]
    $ mocha --recursive
    
and you will see:
    
    Accessing external json Api
        ✓ should respond to GET (526ms)
        passing null URL
            ✓ throws an error
        with basic auth
            ✓ should respond OK with valid credentials (360ms)
            ✓ should return 401 error with invalid username and password (365ms)
    
    sri2db save content
        ✓ should throw an error if not table is defined
        ✓ persist JSON from api to configured postgres table (765ms)
        ✓ should update the same resource if it is saved again (574ms)
    
    Accessing local json Api
        ✓ should respond to GET
    
    Connecting to a correct Postgres DataBase
        ✓ should respond with no error
    
    sri2db save an array of resources
        ✓ persist JSON from api to configured postgres table (51263ms)
        ✓ should saved last sync time
    
    sri2db.saveResources with filter
        ✓ should persist less resources than sri2db.saveResources without filter (61595ms)
    
    sri2db read an url property from jsonb 
        ✓ should save the data content in passed table (219054ms)
    
    13 passing (7m)
