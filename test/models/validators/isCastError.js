var assert = require('assert');
var mongoose = require('mongoose');

var isCastError = require('../../../models/validators/isCastError');

describe('models.validators.isCastError', function () {
    it('returns `false` when passing non mongoose error', function () {
        
        [null, undefined, {}, [], 
         '', 'bar', 0.0, {bar: 'bar'}, 
         ['bar'], new Error()].forEach(function (v) {
            
            assert.strictEqual(isCastError(v), false);
        });
    });

    it('returns `false` when passing mongoose error different from cast error', function () {
        var mongooseErr = new mongoose.Error();
        var mongooseErr2 = new mongoose.Error();

        mongooseErr2.name = 'UniqueError';

        [mongooseErr, mongooseErr2].forEach(function (v) {
            assert.strictEqual(isCastError(v), false);
        });
    });

    it('returns `true` when passing mongoose cast error', function () {
        var mongooseErr = new mongoose.Error();

        mongooseErr.name = 'CastError';

        assert.strictEqual(isCastError(mongooseErr), true);
    });
});