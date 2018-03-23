var path = require('path');

var mongoDBObjectIDPattern = '[0-9a-fA-F]{24}';

/* SHA-1 */
var resetPasswordRequestsCodePattern = '[a-f0-9]{40}';
var validateEmailRequestsCodePattern = '[a-f0-9]{40}';

var uploadHashPattern = '[a-f0-9]{40}';
var photosURLSizePattern = '[0-9]{2,}';

var validEventTypesForHook = [
    'USER_DID_REVOKE_ACCESS', 
    'USER_DID_UPDATE_PERSONAL_INFORMATION'
];

module.exports = {
    ENV: process.env.NODE_ENV,

    PORT: parseInt(process.env.PORT),

    TMP_PATH: path.resolve(__dirname + '/../tmp'),

    EVENID_LOCALES: {
        ENABLED: ['en-us', 'fr-fr'],
        DEFAULT: 'en-us'
    },

    EVENID_MONGODB: {
        URI: process.env.MONGODB_PORT_27017_TCP_ADDR 
                ? ('mongodb://'
                    + process.env.MONGODB_PORT_27017_TCP_ADDR
                    + ':' 
                    + process.env.MONGODB_PORT_27017_TCP_PORT
                    + '/test')
                : process.env.MONGODB_URI,
        
        OBJECT_ID_PATTERN: mongoDBObjectIDPattern,
        
        UNIQUE_INDEXES_PATH: {
            'uri': /client_1_uri_1/,
            'event_type': /client_1_event_type_1/,
            'nickname': /nickname_1/,
            'email': /address_1/
        }
    },

    EVENID_APP: {
        NAME: 'EvenID',
        LOGO: process.env.EVENID_AWS_CLOUDFRONT_ASSETS_URL + '/branding/img/logo@3x.png',

        ENDPOINT: process.env.EVENID_APP_ENDPOINT,

        CLIENT_ID: process.env.EVENID_APP_CLIENT_ID,
        CLIENT_SECRET: process.env.EVENID_APP_CLIENT_SECRET,
        
        // Used for convenience during testing
        AUTHORIZATION_HTTP_HEADER: 'Basic ' + new Buffer(process.env.EVENID_APP_CLIENT_ID 
                                                         + ':' 
                                                         + process.env.EVENID_APP_CLIENT_SECRET)
                                                        .toString('base64'),
        AUTHORIZATION_HTTP_HEADER_WITHOUT_SECRET: 'Basic ' + new Buffer(process.env.EVENID_APP_CLIENT_ID 
                                                                        + ':')
                                                                       .toString('base64'),
    },

    EVENID_API: {
        ACCESS_TOKEN_WHITELIST: [
            '^/oauth/token$',
            '^/oauth/inspect-token$',
            '^/health$'
        ],

        EXPOSED_METHODS: [
            '^/users/(' + mongoDBObjectIDPattern + ')$',
            '^/users/(' + mongoDBObjectIDPattern 
                + ')/(emails)/(' + mongoDBObjectIDPattern 
                + ')/validate$'
        ]
    },

    EVENID_OAUTH: {
        SUPPORTED_HTTP_METHODS: ['GET', 'POST'],

        HASHING_ALGORITHMS: {
            // Access and refresh tokens
            TOKENS: 'sha512',
            AUTHORIZATION_CODES: 'sha512'
        },

        PATTERNS: {
            // SHA-1
            TOKENS: '[a-f0-9]{40}',
            CLIENT_SECRETS: '[a-f0-9]{40}',
            USER_EVENTS_PERIOD: '^[1-9]+ (days?|months?|years?)$'
        },

        VALIDITY_PERIODS: {
            // 5 minutes
            AUTHORIZATION_CODES: 300,
            // 1 hour
            ACCESS_TOKENS: 3600
        },

        VALID_RESPONSE_TYPES: ['code', 'token'],
        
        VALID_AUTHORIZATION_TYPES: ['authorization_code', 'token', 
                                    'password', 'client_credentials'],

        VALID_GRANT_TYPES: ['authorization_code', 'password', 
                            'client_credentials', 'refresh_token'],

        APP_ONLY_GRANT_TYPES: ['client_credentials', 'password'],

        CLIENTS_ONLY_GRANT_TYPES: ['authorization_code'],

        VALID_USER_STATUS: ['new_user', 'existing_user', 
                            'existing_user_after_test', 
                            'existing_user_after_update'],

        VALID_USER_SCOPE: ['emails', 'first_name', 
                           'last_name', 'nickname', 
                           'profil_photo', 'gender', 
                           'date_of_birth', 'place_of_birth', 
                           'nationality', 'timezone',
                           'phone_numbers', 'addresses'],

        VALID_USER_SCOPE_FLAGS: ['separate_shipping_billing_address', 
                                 'mobile_phone_number', 
                                 'landline_phone_number'],

        VALID_APP_SCOPE: ['unauthenticated_app', 'app', 'app_developer'],

        PLURAL_SCOPE: ['emails', 'addresses', 'phone_numbers'],

        VALID_AUTHORIZATION_ENTITIES: ['emails', 'phone_numbers', 'addresses'],

        ENTITIES_READY_FOR_NEW_CLIENTS: ['addresses'],
        
        ENTITIES_READY_FOR_UPDATE: ['users', 'emails', 'phone_numbers', 'addresses'],

        VALID_ENTITY_UPDATE_STATUS: ['new', 'updated', 'deleted'],

        VALID_ENTITY_ID_TYPES: ['users', 'emails', 'unknown_phone_numbers', 
                                'mobile_phone_numbers', 'landline_phone_numbers',
                                'addresses'],

        VALID_EVENT_TYPES_FOR_ENTITY: ['save', 'remove', 'validate'],

        VALID_ENTITY_FIELDS: {
            USERS: ['first_name', 'last_name', 
                    'nickname', 'profil_photo', 
                    'gender', 'date_of_birth', 
                    'place_of_birth', 'nationality',
                    'timezone'],

            EMAILS: ['address', 'is_verified'],

            PHONE_NUMBERS: ['number', 'phone_type'],
            
            ADDRESSES: ['address_type', 'full_name', 
                        'address_line_1', 'address_line_2', 
                        'access_code', 'city', 
                        'state', 'postal_code', 'country',
                        'first_for']
        },

        VALID_EVENT_TYPES_FOR_HOOK: validEventTypesForHook,
        VALID_EVENT_TYPES_FOR_USER: ['login', 'registration', 
                                     'deregistration', 
                                     'test_account_registration', 
                                     'test_account_converted'],

        VALID_FLOW: ['login', 'registration', 'recover_password']
    },

    EVENID_USERS: {
        MAX_LENGTHS: {
            PASSWORD: 6,
            NICKNAME: 50,
            FIRST_NAME: 50,
            LAST_NAME: 50
        },

        MAX_ENTITIES: {
            EMAILS: 10,
            PHONE_NUMBERS: 10,
            ADDRESSES: 10,
            CLIENTS: 10
        }
    },

    EVENID_USER_RESET_PASSWORD_REQUESTS: {
        TIMEOUT: 86400,
        MAX_ATTEMPTS: parseInt(process.env.EVENID_USER_RESET_PASSWORD_REQUESTS_MAX_ATTEMPTS),
        CODE: {
            HASHING_ALGORITHM: 'sha512',
            PATTERN: resetPasswordRequestsCodePattern,
            // 20 min
            VALIDITY_PERIOD: 1200
        }
    },

    EVENID_USER_VALIDATE_EMAIL_REQUESTS: {
        TIMEOUT: 86400,
        MAX_ATTEMPTS: parseInt(process.env.EVENID_USER_VALIDATE_EMAIL_REQUESTS_MAX_ATTEMPTS),
        CODE: {
            HASHING_ALGORITHM: 'sha512',
            PATTERN: validateEmailRequestsCodePattern,
            // 20 min
            VALIDITY_PERIOD: 1200
        }
    },

    EVENID_EMAILS: {
        // From
        SOURCE: process.env.EVENID_EMAILS_SOURCE,

        // If the recipient replies to the message, 
        // each reply-to address will receive the reply
        REPLY_TO_ADDRESSES: [
            process.env.EVENID_EMAILS_REPLY_TO_ADDRESS
        ],
        
        // The email address to which bounces 
        // and complaints are to be forwarded
        RETURN_PATH: process.env.EVENID_EMAILS_RETURN_PATH,

        MAX_LENGTHS: {
            ADDRESS: 50
        }
    },

    EVENID_ADDRESSES: {
        MAX_LENGTHS: {
            FULL_NAME: 100,
            ADDRESS_LINE_1: 100,
            ADDRESS_LINE_2: 100,
            ACCESS_CODE: 10,
            CITY: 50,
            STATE: 50,
            POSTAL_CODE: 50
        },

        FOR: ['addresses', 'billing', 'shipping']
    },

    EVENID_OAUTH_CLIENTS: {
        MAX_LENGTHS: {
            NAME: 25,
            WEBSITE: 50,
            DESCRIPTION: 50,
            FACEBOOK_USERNAME: 25,
            TWITTER_USERNAME: 25,
            INSTAGRAM_USERNAME: 25,
        },

        MAX_ENTITIES: {
            REDIRECTION_URIS: 10,
            HOOKS: validEventTypesForHook.length
        }
    },

    EVENID_OAUTH_REDIRECTION_URIS: {
        MAX_LENGTHS: {
            URI: 150
        }
    },

    EVENID_OAUTH_HOOKS: {
        MAX_LENGTHS: {
            URL: 150
        }
    },

    EVENID_EVENTS: {
        TYPES: [
            'check_for_user_existence',
            'user_created',
            'invalid_login',
            'upload_policy_generated'
        ],

        TIMEOUTS: {
            // One day
            CHECK_FOR_USER_EXISTENCE: 86400,
            USER_CREATED: 86400,
            INVALID_LOGIN: 86400,
            UPLOAD_POLICY_GENERATED: 86400
        },

        MAX_ATTEMPTS: {
            CHECK_FOR_USER_EXISTENCE: parseInt(process.env
                                                      .EVENID_EVENTS_CHECK_FOR_USER_EXISTENCE),
            
            USER_CREATED: parseInt(process.env
                                          .EVENID_EVENTS_USER_CREATED_MAX_ATTEMPTS),
            
            INVALID_LOGIN: parseInt(process.env
                                           .EVENID_EVENTS_INVALID_LOGIN_MAX_ATTEMPTS),
            
            UPLOAD_POLICY_GENERATED: parseInt(process.env
                                                     .EVENID_EVENTS_UPLOAD_POLICY_GENERATED_MAX_ATTEMPTS)
        }
    },

    EVENID_UPLOADS: {
        HASH: {
            ALGORITHM: 'sha1',
            PATTERN: uploadHashPattern
        }
    },

    EVENID_PHOTOS: {
        ALLOWED_RESIZE_ACTIONS: ['resize', 'thumbnail'],

        URL_SIZE_PATTERN: photosURLSizePattern,

        AVAILABLE_SIZES: [25, 50, 100, 200],

        MAX_FILE_SIZES: {
            // 100 KB
            CLIENT_LOGOS: 102400,
            // 4MB
            USER_PROFIL_PHOTOS: 4194304
        },

        PROPERTIES: {
            // Ten years
            CACHE_CONTROL_MAX_AGE: 3600 * 24 * 365 * 10,
            ACL: 'private'
        }
    },

    EVENID_AWS: {
        ACCESS_KEY_ID: process.env.EVENID_AWS_ACCESS_KEY_ID,
        ACCESS_KEY_SECRET: process.env.EVENID_AWS_ACCESS_KEY_SECRET,

        CLOUDFRONT: {
            URLS: {
                ASSETS: process.env.EVENID_AWS_CLOUDFRONT_ASSETS_URL,
                UPLOADS: process.env.EVENID_AWS_CLOUDFRONT_UPLOADS_URL
            }
        },
        
        S3: {
            BUCKETS: {
                ASSETS: process.env.EVENID_AWS_S3_ASSETS_BUCKET,
                UPLOADS: process.env.EVENID_AWS_S3_UPLOADS_BUCKET
            },

            UPLOADS_BUCKET: {
                AUTHORIZED_KEYS: [
                    '^users/profil-photos/' + uploadHashPattern + '$',
                    '^clients/logos/' + uploadHashPattern + '$'
                ]
            },

            REGION: process.env.EVENID_AWS_S3_REGION
        },

        SES: {
            REGION: process.env.EVENID_AWS_SES_REGION
        },

        SQS: {
            REGION: process.env.EVENID_AWS_SQS_REGION,
            QUEUE_URL: process.env.EVENID_AWS_SQS_QUEUE_URL
        }
    },

    EVENID_RECAPTCHA: {
        PUBLIC_KEY: process.env.EVENID_RECAPTCHA_PUBLIC_KEY,
        PRIVATE_KEY: process.env.EVENID_RECAPTCHA_PRIVATE_KEY
    }
};