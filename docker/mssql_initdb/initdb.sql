
CREATE TABLE sri2db_large (href varchar(512) NOT NULL, jsondata nvarchar(MAX), modified datetime NOT NULL, [key] varchar(100) NOT NULL, /*resourcetype varchar(100) NOT NULL,*/ path varchar(288) NOT NULL, baseurl varchar(100) NOT NULL);
-- REMARK: varchar sizes have been carefully chosen to avoid the warning:
--   "Warning! The maximum key length for a clustered index is 900 bytes. The index 'sri2db_large_baseurl_path_href_cidx' has maximum length of *** bytes. For some combination of large values, the insert/update operation will fail."
-- create 2 unique indexes (1 of them clustered) on href, but if you have path and baseurl in the table the index should contain these fields too
CREATE UNIQUE clustered INDEX sri2db_large_baseurl_path_href_cidx ON sri2db_large (href, path, baseurl) with (data_compression = page);
CREATE UNIQUE           INDEX sri2db_large_baseurl_path_href_idx ON sri2db_large (href, path, baseurl) with (data_compression = page);

-- or if no baseurl colomn
CREATE TABLE sri2db_medium (href varchar(512) NOT NULL, jsondata nvarchar(MAX), modified datetime NOT NULL, [key] varchar(100) NOT NULL, /*resourcetype varchar(100) NOT NULL,*/ path varchar(256) NOT NULL);
CREATE UNIQUE clustered INDEX sri2db_medium_baseurl_path_href_cidx ON sri2db_medium (href, path) with (data_compression = page);
CREATE UNIQUE           INDEX sri2db_medium_baseurl_path_href_idx ON sri2db_medium (href, path) with (data_compression = page);

-- or if no baseurl and no path column
CREATE TABLE sri2db_small (href varchar(512) NOT NULL, jsondata nvarchar(MAX), modified datetime NOT NULL, [key] varchar(100) NOT NULL, /*resourcetype varchar(100) NOT NULL,*/);
CREATE UNIQUE clustered INDEX sri2db_small_baseurl_path_href_cidx ON sri2db_small (href) with (data_compression = page);
CREATE UNIQUE           INDEX sri2db_small_baseurl_path_href_idx ON sri2db_small (href) with (data_compression = page);
