var Type = require('type-of-is');

var config = require('../../../../config');

var updateOauthUserStatus = require('../../../../models/actions/updateOauthUserStatus');

// If user was forced to authorize additional fields
// we needs to update the user status
module.exports = function (req, res, next) {
    var client = res.locals.client;
    var user = res.locals.user;
    var useTestAccount = res.locals.useTestAccount;

    var authorizedEntities = res.locals.authorizedEntities;
    var userAuthorizationForClient = res.locals.userAuthorizationForClient;

    var oauthAuthorization = res.locals.oauthAuthorization;

    var userWasForcedToAuthorizeAdditionalFields = res.locals.userWasForcedToAuthorizeAdditionalFields;
    var additionalScope = res.locals.additionalScope;

    var separateShipAndBill = false;

    /* When client wants to separate 
       shipping and billing address
       user may use the same address 
       than before, so make sure
       it was not included in updated fields */

    var authorized = {
        emails: [],
        // Use underscore to match oauth 
        // user status properties.
        // See below.
        phone_numbers: [],
        addresses: []
    };
    var entitiesToKeepInUpdatedFields = {};

    /* END */

    var toAuthorize = {
        emails: [],
        // Use underscore to match oauth 
        // user status properties.
        // See below.
        phone_numbers: [],
        addresses: []
    };

    var oauthUserStatus = {
        status: 'existing_user_after_update',
        updated_fields: additionalScope,
        updated_emails: [],
        updated_phone_numbers: [],
        updated_addresses: []
    };

    var objectIDToString = function (v) {
        return v.toString();
    };

    if (!client) {
        throw new Error('`client` must be set as response locals ' 
                        + 'property before calling `updateOauthUserStatusIfNeeded` ' 
                        + 'middleware');
    }

    if (!user) {
        throw new Error('`user` must be set as response locals '
                        + 'property before calling `updateOauthUserStatusIfNeeded` '
                        + 'middleware');
    }

    if (!Type.is(useTestAccount, Boolean)) {
        throw new Error('`useTestAccount` must be set as response locals '
                        + 'property before calling `updateOauthUserStatusIfNeeded` '
                        + 'middleware');
    }

    if (useTestAccount) {
        return next();
    }

    // Not set if test account was used
    if (!userAuthorizationForClient) {
        throw new Error('`userAuthorizationForClient` must be set as response locals '
                        + 'property before calling `updateOauthUserStatusIfNeeded` '
                        + 'middleware');
    }

    if (!oauthAuthorization) {
        throw new Error('`oauthAuthorization` must be set as response locals '
                        + 'property before calling `updateOauthUserStatusIfNeeded` '
                        + 'middleware');
    }

    // Not set if test account was used
    if (!authorizedEntities) {
        throw new Error('`authorizedEntities` must be set as response locals '
                        + 'property before calling `updateOauthUserStatusIfNeeded` '
                        + 'middleware');
    }

    // NOT SET if user use test account.
    // `userWasForcedToAuthorizeAdditionalFields` may be equals to `false`
    // so check for 'undefinedness'.
    // Given by `findFieldsToAuthorize` middleware.
    if (Type.is(userWasForcedToAuthorizeAdditionalFields, undefined)) {
        throw new Error('`userWasForcedToAuthorizeAdditionalFields` must be set '
                        + 'as response locals property before calling '
                        + '`updateOauthUserStatusIfNeeded` middleware');
    }

    // Same than above
    if (!Type.is(additionalScope, Array)) {
        throw new Error('`additionalScope` must be set as response locals '
                        + 'property before calling `updateOauthUserStatusIfNeeded` ');
    }

    // We have nothing to do
    if (!userWasForcedToAuthorizeAdditionalFields) {
        return next();
    }

    authorized.emails = userAuthorizationForClient.entities
                                                  .emails
                                                  .map(objectIDToString);

    authorized.phone_numbers = userAuthorizationForClient.entities
                                                         .phone_numbers
                                                         .map(objectIDToString);

    authorized.addresses = userAuthorizationForClient.entities
                                                     .addresses
                                                     .map(objectIDToString);

    
    toAuthorize.emails = authorizedEntities.emails
                                           .map(objectIDToString);
    
    toAuthorize.phone_numbers = [].concat(
        authorizedEntities.unknown_phone_numbers,
        authorizedEntities.mobile_phone_numbers,
        authorizedEntities.landline_phone_numbers
    ).map(objectIDToString);

    toAuthorize.addresses = authorizedEntities.addresses
                                              .map(objectIDToString);


    separateShipAndBill = oauthAuthorization.scope_flags
                                            .indexOf('separate_shipping_billing_address') !== -1;

    // Populate oauth user status with
    // newly authorized entity
    Object.keys(toAuthorize).forEach(function (key) {
        var entitiesToAuthorize = toAuthorize[key];
        var authorizedEntities = authorized[key];

        if (entitiesToAuthorize.length === 0) {
            return;
        }

        entitiesToAuthorize.forEach(function (entityToAuthorize) {
            // Entity was already authorized. Pass.
            if (authorizedEntities.indexOf(entityToAuthorize) !== -1) {
                // User was forced to choose 
                // an address for billing and shipping.
                // Make sure client will be notified.
                if (key === 'addresses'
                    && separateShipAndBill) {

                    entitiesToKeepInUpdatedFields[key] = true;

                    oauthUserStatus['updated_' + key].push({
                        id: entityToAuthorize,
                        status: 'updated',
                        updated_fields: ['first_for']
                    });
                }

                return;
            }

            entitiesToKeepInUpdatedFields[key] = true;

            oauthUserStatus['updated_' + key].push({
                id: entityToAuthorize,
                status: 'new',
                updated_fields: []
            });
        });
    });

    // Remove entities that was already authorized
    // (like addresses if client wants to separate 
    // shipping and billing address (asked on each login)) .
    // See above.
    oauthUserStatus.updated_fields = oauthUserStatus.updated_fields.filter(function (v) {
        // Not an entity
        return config.EVENID_OAUTH.PLURAL_SCOPE.indexOf(v) === -1
            // Entity was authorized now
            || Object.keys(entitiesToKeepInUpdatedFields).indexOf(v) !== -1;
    });

    // All entities were already authorized. Pass.
    if (!oauthUserStatus.updated_fields.length) {
        return next();
    }

    updateOauthUserStatus([client.id], user.id, 
                          oauthUserStatus, function (err) {
        
        if (err) {
            return next(err);
        }

        next();
    });
};