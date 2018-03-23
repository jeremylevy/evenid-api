var assert = require('assert');

var createHash = require('../../libs/createHash');

var fooMd5Hash = 'acbd18db4cc2f85cedef654fccc4a4d8';

describe('libs.createHash', function () {
    it('throws an exception when passing '
       + 'non-string value as algorithm', function () {
        
        [null, undefined, {}, 9, []].forEach(function (v) {
            assert.throws(function () {
                createHash(v, 'foo');
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing '
       + 'empty string as algorithm', function () {
        
        assert.throws(function () {
            createHash('', 'foo');
        }, assert.AssertionError);
    });

    it('throws an exception when passing invalid algorithm', function () {
        assert.throws(function () {
            createHash('bar', 'foo');
        }, assert.AssertionError);
    });

    it('throws an exception when passing non-string '
       + 'and non-buffer value as string to hash', function () {
        
        [null, undefined, {}, 9, []].forEach(function (v) {
            assert.throws(function () {
                createHash('md5', v);
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing empty string '
       + 'or empty buffer as string to hash', function () {
        
        ['', new Buffer('')].forEach(function (v) {
            assert.throws(function () {
                createHash('md5', v);
            }, assert.AssertionError);
        });
    });

    it('returns hash when valid algo and string to hash', function () {
        var hash = createHash('md5', 'foo');

        assert.strictEqual(hash, fooMd5Hash);
    });

    it('returns hash when valid algo and buffer to hash', function () {
        var hash = createHash('md5', new Buffer('foo'));

        assert.strictEqual(hash, fooMd5Hash);
    });
});