/**
 * Created by pablo on 22/07/15.
 */
var expect  = require("chai").expect;
var Client = require('./../src/lib/client.js');

var createSri2DbInstance = function (config) {

    return new Client(config);
};

describe('Accessing external json Api', function() {

    this.timeout(0);

    describe('passing null URL', function(){

        it('throws an error', function(){
            var config = {};
            expect(createSri2DbInstance.bind(config)).to.throw(Error);
        })
    });

    it('should respond to GET', function (done) {

        var config = {
            baseApiUrl : "http://dump.getpostman.com",
            functionApiUrl: "/status"
        };

        var sri2db = createSri2DbInstance(config);

        sri2db.getApiContent(function (error,response) {
            expect(response.statusCode).to.equal(200);
            done();
        });
    });

    describe('with basic auth',function(){

        it('should respond OK with valid credentials', function (done) {

            var config = {
                baseApiUrl : "http://dump.getpostman.com",
                functionApiUrl: "/auth/basic",
                credentials: { username: 'postman', password: 'password' }
            };

            var sri2db = createSri2DbInstance(config);

            sri2db.getApiContent(function (error,response) {
                expect(response.statusCode).to.equal(200);
                done();
            });
        });

        it('should return 401 error with invalid username and password',function(done){

            var config = {
                baseApiUrl : "http://dump.getpostman.com",
                functionApiUrl: "/auth/basic",
                credentials: { username: 'bad.user', password: 'bad.passowrd' }
            };

            var sri2db = createSri2DbInstance(config);

            sri2db.getApiContent(function (error,response) {
                expect(response.statusCode).to.equal(401);
                done();
            });
        })
    });


});