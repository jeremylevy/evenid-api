var assert = require('assert');
var Type = require('type-of-is');

var config = require('../../../../../config');

var areValidObjectIDs = require('../../../../validators/areValidObjectIDs')
                               (config.EVENID_MONGODB.OBJECT_ID_PATTERN);

var InvalidRequestError = require('../../../../../errors/types/InvalidRequestError');

// Avoid circular references.
// See below.
var db = null;

module.exports = function (next) {
    assert.ok(areValidObjectIDs([this._id]),
              'context must be set as a `PhoneNumber` document');
    
    assert.ok(Type.is(next, Function),
              'argument `next` must be a function');
    
    var phoneNumber = this;

    var userID = phoneNumber.user;

    var oldPhoneType = phoneNumber._old_phone_type;
    var grantedAuthorizations = phoneNumber._granted_authorizations;

    assert.ok(areValidObjectIDs([userID]),
              'Phone number must contains an `user` property');

    assert.ok(Type.is(grantedAuthorizations, Array),
              'Phone number must contains a `_granted_authorizations` property');

    var modifiedFields = phoneNumber.modifiedPaths();

    var clientsWhichDontWantOldPhoneType = [];
    var clientsWhichWantOldPhoneType = [];

    var updateEntitiesIDFn = [];

    // First creation?
    if (phoneNumber.isNew
        || modifiedFields.indexOf('phone_type') === -1
        // No clients need this phone number
        || !grantedAuthorizations.length
        // Phone type was not updated
        || phoneNumber.phone_type === oldPhoneType) {
        
        return next();
    }

    grantedAuthorizations.forEach(function (authorization) {
        if (authorization.scope_flags
                         .indexOf(oldPhoneType + '_phone_number') === -1) {
            
            clientsWhichDontWantOldPhoneType.push(authorization.client.id);

            return;
        }

        clientsWhichWantOldPhoneType.push(authorization.client.id);
    });

    if (clientsWhichWantOldPhoneType.length) {
        // Some clients want 
        // `mobile/landline_phone_number`
        // scope flags 
        if (phoneNumber.phone_type === 'unknown'
            // Some clients want 
            // `unknown_phone_number` 
            // scope flags
            || oldPhoneType === 'unknown') {

            // Number for countries 
            // like US which don't have type
            if (phoneNumber.phone_type === 'unknown') {
                // We suppose that this phone type 
                // is the same than the one used 
                // when registering on client
                phoneNumber.phone_type = oldPhoneType;

                return next();
            }

            /* (oldPhoneType === 'unknown')
               Clients have asked 
               for unknown phone number
               and user has specified type. 
               Add specified type to entity ID. */
        } else {
            return next(new InvalidRequestError({
                number: 'You must use a ' + oldPhoneType + ' phone number.'
            }));
        }
    }

    if (clientsWhichDontWantOldPhoneType.length
        // See above.
        || oldPhoneType === 'unknown') {
        
        // Avoid circular reference 
        // by requiring function directly in middleware.
        // Db load model
        // which requires `db`
        // which requires db.
        // TODO: Find a clever solution
        if (!db) {
            db = require('../../../../index');
        }

        db.models.OauthEntityID.update({
            user: userID,
            client: {
                $in: clientsWhichDontWantOldPhoneType
            },
            real_id: phoneNumber._id
        }, {
            $addToSet: {
                entities: phoneNumber.phone_type + '_phone_numbers'
            }
        }, {
            multi: clientsWhichDontWantOldPhoneType.length > 1
        }, function (err, rawResponse) {
            if (err) {
                return next(err);
            }

            next();
        });

        return;
    }

    next();
};