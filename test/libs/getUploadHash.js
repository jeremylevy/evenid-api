var assert = require('assert');
var Type = require('type-of-is');

var config = require('../../config');

var getUploadHash = require('../../libs/getUploadHash');

var firstUploadHash = null;

describe('libs.getUploadHash', function () {
    it('returns valid upload hash', function () {
        firstUploadHash = getUploadHash();

        assert.ok(
            Type.is(firstUploadHash, String) &&
            firstUploadHash.match(new RegExp(
                config.EVENID_UPLOADS.HASH.PATTERN
            ))
        );
    });

    it('does not return the same hash each time', function () {
        var secondUploadHash = getUploadHash();

        assert.ok(firstUploadHash !== secondUploadHash);
    });
});