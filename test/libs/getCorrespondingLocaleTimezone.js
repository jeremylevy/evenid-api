var assert = require('assert');

var getCorrespondingLocaleTimezone = require('../../libs/getCorrespondingLocaleTimezone');

describe('libs.getCorrespondingLocaleTimezone', function () {
    it('throws an exception when passing '
       + 'invalid value as locale', function () {
        
        [null, undefined, {}, 9, [], 'bar', function () {}].forEach(function (v) {
            assert.throws(function () {
                getCorrespondingLocaleTimezone(v, 'Europe/Paris');
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing '
       + 'invalid value as timezone', function () {
        
        [null, undefined, {}, 9, [], 'bar', function () {}].forEach(function (v) {
            assert.throws(function () {
                getCorrespondingLocaleTimezone('en-us', v);
            }, assert.AssertionError);
        });
    });

    it('returns `UTC` when passed timezone is UTC', function () {
        var correspondingTimezone = getCorrespondingLocaleTimezone('fr-fr', 'UTC');

        assert.strictEqual(correspondingTimezone, 'UTC');
    });

    it('returns corresponding timezone for `fr-fr`', function () {
        var correspondingTimezone = getCorrespondingLocaleTimezone('fr-fr', 'Africa/Cairo');

        assert.strictEqual(correspondingTimezone, 'Caire');
    });

    it('returns corresponding timezone for `en-us`', function () {
        var correspondingTimezone = getCorrespondingLocaleTimezone('en-us', 'Africa/Cairo');

        assert.strictEqual(correspondingTimezone, 'Cairo');
    });
});