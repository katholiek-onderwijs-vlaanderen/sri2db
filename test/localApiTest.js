/**
 * Created by pablo on 27/07/15.
 */
var expect  = require("chai").expect;
var express = require('express');
var Client = require('./../src/lib/client.js');

var createSri2DbInstance = function (config) {

    return new Client(config);
};

describe('Accessing local json Api', function() {

    it('should respond to GET', function (done) {

        var app = express();

        app.get('/', function (req, res) {
            res.json({key:'value'});
        });

        app.listen(3000, function () {

            var config = {
                baseApiUrl : " http://localhost:3000/",
                functionApiUrl : ""
            }
            var sri2db = createSri2DbInstance(config);

            sri2db.getApiContent(function (error,response) {
                expect(response.statusCode).to.equal(200);
                done();
            });

        });
    });
});