var assert = require('assert');
var Type = require('type-of-is');

var config = require('../config');

var areValidObjectIDs = require('../models/validators/areValidObjectIDs')
                               (config.EVENID_MONGODB.OBJECT_ID_PATTERN);

module.exports = function (clientEntitiesIDForUser) {
    assert.ok(Type.is(clientEntitiesIDForUser, Array),
            'argument `clientEntitiesIDForUser` must be an array');
    
    return function (entity, wantedIDType, givenID) {
        assert.ok(config.EVENID_OAUTH
                        .VALID_ENTITY_ID_TYPES
                        .indexOf(entity) !== -1,
                'argument `entity` is invalid');

        assert.ok(['real', 'fake'].indexOf(wantedIDType) !== -1,
                'argument `wantedIDType` is invalid');

        assert.ok(!givenID || areValidObjectIDs([givenID]),
                'argument `givenID` must be an ObjectID');

        var givenIDType = wantedIDType === 'real' ? 'fake' : 'real';
        var ret = undefined;
        
        clientEntitiesIDForUser.forEach(function (clientEntityIDForUser) {
            if ((!givenID
                    || clientEntityIDForUser[givenIDType + '_id'].toString() === givenID.toString())
                && clientEntityIDForUser.entities.indexOf(entity) !== -1) {

                ret = clientEntityIDForUser[wantedIDType + '_id'].toString();
            }
        });

        return ret;
    };
};