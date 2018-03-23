var assert = require('assert');

var isUniqueIndexError = require('../../../models/validators/isUniqueIndexError');

describe('models.validators.isUniqueIndexError', function () {
    it('returns `false` when passing non unique index error', function () {
        
        [null, undefined, {}, [], 
         '', 'bar', 0.0, {bar: 'bar'},
         ['bar'], new Error()].forEach(function (v) {
            
            assert.strictEqual(isUniqueIndexError(v), false);
        });
    });

    it('returns `false` when passing unique index error'
    + ' with fallacious code', function () {

        var uniqueIndexErr = new Error();

        uniqueIndexErr.name = 'MongoError';
        uniqueIndexErr.code = 32984;

        assert.strictEqual(isUniqueIndexError(uniqueIndexErr), false);
    });

    it('returns `true` when passing unique index error', function () {
        var uniqueIndexErr = new Error();
        var uniqueIndexErr2 = new Error();

        uniqueIndexErr.name = 'MongoError';
        uniqueIndexErr2.name = 'MongoError';

        // An unique index error may 
        // takes multiple error codes
        uniqueIndexErr.code = 11000;
        uniqueIndexErr2.code = 11001;

        [uniqueIndexErr, uniqueIndexErr2].forEach(function (v) {
            assert.strictEqual(isUniqueIndexError(v), true);
        });
    });
});