
CREATE TABLE sri2db_large (href varchar, jsondata jsonb, modified timestamptz, key varchar, resourcetype varchar, path varchar, baseurl varchar);
CREATE INDEX sri2db_large_baseurl_path_modified_idx ON sri2db_large (baseurl, path, modified);

-- or if no baseurl colomn
CREATE TABLE sri2db_medium (href varchar, jsondata jsonb, modified timestamptz, key varchar, resourcetype varchar, path varchar);
CREATE INDEX sri2db_medium_path_modified_idx ON sri2db_medium (path, modified);

-- or if no baseurl and no path column
CREATE TABLE sri2db_small (href varchar, jsondata jsonb, modified timestamptz, key varchar, resourcetype varchar, path varchar);
CREATE INDEX sri2db_small_modified_idx ON sri2db_small (modified);
