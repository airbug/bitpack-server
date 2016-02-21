//-------------------------------------------------------------------------------
// Imports
//-------------------------------------------------------------------------------

import {
    Class,
    Obj,
    Promises,
    Proxy,
    Throwables,
    TypeUtil
} from 'bugcore';
import AWS from 'aws-sdk';
import express from 'express';
import {
    core,
    managers,
    util
} from 'gulp-recipe';


//-------------------------------------------------------------------------------
// Simplify References
//-------------------------------------------------------------------------------

const {
    PublishKeyManager,
    RecipeVersionManager
} = managers;


//-------------------------------------------------------------------------------
// Declare Class
//-------------------------------------------------------------------------------

/**
 * @class
 * @extends {Obj}
 */
const Api = Class.extend(Obj, {

    _name: 'bitrecipe.routes.Api',


    //-------------------------------------------------------------------------------
    // Constructor
    //-------------------------------------------------------------------------------

    /**
     * @constructs
     */
    _constructor() {

        this._super();


        //-------------------------------------------------------------------------------
        // Public Properties
        //-------------------------------------------------------------------------------

        /**
         * @private
         * @type {Router}
         */
        this.router = null;
    },


    //-------------------------------------------------------------------------------
    // Getters and Setters
    //-------------------------------------------------------------------------------


    //-------------------------------------------------------------------------------
    // Public Methods
    //-------------------------------------------------------------------------------

    /**
     *
     */
    routes() {
        if (!this.router) {
            this.router = express.Router();

            this.router.use((request, response, next) => {
                console.log('Time: ', Date.now());
                next();
            });

            this.router.get('/', (request, response) => {
                response.send(' home page');
            });

            this.router.get('/api', (request, response) => {
                response.send('api');
            });

            this.router.post('/api/v1/publish', (request, response) => {
                const authorization = request.headers.authorization;
                this.publishRecipe(authorization, request)
                    .then(() => {
                        return response.send({ response: 'success' });
                    })
                    .catch((error) => {
                        console.log(error);
                        console.log(error.stack);
                        if (error.type === 'BAD_AUTHORIZATION') {
                            return this.responseAccessDenied(response);
                        }
                        return this.responseError(response, Throwables.exception('UNCAUGHT_EXCEPTION', {}, '', [error]));
                    });
            });
        }
        return this.router;
    },


    //-------------------------------------------------------------------------------
    // Private Methods
    //-------------------------------------------------------------------------------

    /**
     * @private
     * @param {string} key
     * @return {Promise.<PublishKeyEntity>}
     */
    loadPublishKey(key) {
        return PublishKeyManager.get({key});
    },

    /**
     * @private
     * @param {string} recipeName
     * @param {string} versionNumber
     * @return {Promise.<RecipeVersionEntity>}
     */
    loadRecipeVersion(recipeName, versionNumber) {
        return RecipeVersionManager.get({
            recipeName,
            recipeScope: 'public',
            recipeType: 'gulp',
            versionNumber
        });
    },

    /**
     * @private
     * @param {PublishKeyEntity} publishKeyEntity
     */
    markPublishKeyUsed(publishKeyEntity) {
        return PublishKeyManager.update({ key: publishKeyEntity.getKey() }, {
            usedAt: util.Firebase.timestamp()
        });
    },

    /**
     * @private
     * @param {Response} response
     */
    responseAccessDenied(response) {
        return response.status(403).send({ response: 'ACCESS_DENIED' });
    },

    /**
     * @private
     * @param {Response} response
     * @param {Throwable} error
     */
    responseError(response, error) {
        //TODO BRN: Add config debug check
        console.log(error);
        console.log(error.stack);
        return response.status(500).send({ response: error.getType() });
    },

    /**
     * @private
     * @param {string} authorization
     * @returns {string}
     */
    parseAuthorization(authorization) {
        return authorization.split(' ')[1];
    },

    /**
     * @private
     * @param {string} authorization
     * @param {Stream} recipePackageStream
     * @return {Promise<>}
     */
    publishRecipe(authorization, recipePackageStream) {
        return Promises.try(() => {
            if (!TypeUtil.isString(authorization)) {
                throw Throwables.exception('BAD_AUTHORIZATION', {}, 'Authorization not received');
            }
            const key = this.parseAuthorization(authorization);
            if (!TypeUtil.isString(key)) {
                throw Throwables.exception('BAD_AUTHORIZATION', {}, 'Publish key could not be parsed');
            }
            return this.loadPublishKey(key);
        }).then((publishKeyData) => {
            this.validatePublishKey(publishKeyData);
            return this.markPublishKeyUsed(publishKeyData);
        }).then((publishKeyData) => {

            // TODO RecipeServer
            // unpack stream to...
            // - validate recipe name
            // - validate recipe version

            return core.RecipePackage.fromStream(recipePackageStream)
                .then((recipePackage) => {
                    return [publishKeyData, recipePackage];
                });
        }).then((results) => {
            const [publishKeyData, recipePackage] = results;
            this.validateRecipePackage(publishKeyData, recipePackage);
            return this.loadRecipeVersion(publishKeyData.getRecipeName(), publishKeyData.getRecipeVersionNumber())
                .then((recipeVersionData) => {
                    return [publishKeyData, recipePackage, recipeVersionData];
                });
        }).then((results) => {
            const [publishKeyData, recipePackage, recipeVersionData] = results;
            this.validateRecipeVersion(recipeVersionData);
            return this.uploadRecipePackage(publishKeyData, recipePackage)
                .then((recipeUrl) => {
                    return RecipeVersionManager.updatePublished(publishKeyData.getRecipeName(), publishKeyData.getRecipeVersionNumber(), {
                        published: true,
                        recipeHash: recipePackage.getRecipeHash(),
                        recipeUrl: recipeUrl
                    });
                });
        });
    },

    /**
     * @private
     * @param {PublishKeyData} publishKeyData
     * @param {RecipePackage} recipePackage
     * @return {Promise<string>}
     */
    uploadRecipePackage(publishKeyData, recipePackage) {
        return Promises.promise((resolve, reject) => {
            const s3Stream = require('s3-upload-stream')(new AWS.S3());
            const upload = s3Stream.upload({
                ACL: 'public-read',
                Bucket: 'gulp-recipe',
                ContentType: 'application/x-compressed',
                Key: 'recipes/' + publishKeyData.getRecipeType() + '/' + publishKeyData.getRecipeScope() + '/'
                    + publishKeyData.getRecipeName() + '/' + publishKeyData.getRecipeVersionNumber() + '/' +
                    publishKeyData.getRecipeType() + '-' + publishKeyData.getRecipeScope() + '-' +
                    publishKeyData.getRecipeName() + '-' + publishKeyData.getRecipeVersionNumber() + '.tgz',
                ServerSideEncryption: 'AES256'
            });

            upload.maxPartSize(20971520);
            upload.concurrentParts(5);

            upload.on('error', function (error) {
                console.log(error);
                reject(error);
            });

            upload.on('part', function (details) {
                console.log(details);
            });

            upload.on('uploaded', function (details) {
                resolve(decodeURIComponent(details.Location));
            });

            recipePackage.getRecipeStream().pipe(upload);
        });
    },

    /**
     * @private
     * @param {PublishKeyData} publishKeyData
     * @return {PublishKeyData}
     */
    validatePublishKey(publishKeyData) {
        if (!publishKeyData) {
            throw Throwables.exception('BAD_AUTHORIZATION', {}, 'Could not find PublishKey');
        }
        if (publishKeyData.getUsedAt()) {
            throw Throwables.exception('BAD_AUTHORIZATION', {}, 'Publish key has already been used');
        }
    },

    /**
     * @private
     * @param {PublishKeyData} publishKeyData
     * @param {RecipePackage} recipePackage
     */
    validateRecipePackage(publishKeyData, recipePackage) {
        if (recipePackage.getRecipeHash() !== publishKeyData.getRecipeHash()) {
            throw Throwables.exception('BAD_PACKAGE', {}, 'Package hash does not match publish data');
        }
    },

    /**
     * @private
     * @param {RecipeVersionData} recipeVersionData
     */
    validateRecipeVersion(recipeVersionData) {
        if (recipeVersionData.getPublished()) {
            throw Throwables.exception('RECIPE_ALREADY_PUBLISHED', {}, 'A recipe has already been published for this version');
        }
    }
});


//-------------------------------------------------------------------------------
// Private Static Properties
//-------------------------------------------------------------------------------

/**
 * @static
 * @private
 * @type {Api}
 */
Api.instance        = null;


//-------------------------------------------------------------------------------
// Static Methods
//-------------------------------------------------------------------------------

/**
 * @static
 * @return {Api}
 */
Api.getInstance = function() {
    if (Api.instance === null) {
        Api.instance = new Api();
    }
    return Api.instance;
};


//-------------------------------------------------------------------------------
// Static Proxy
//-------------------------------------------------------------------------------

Proxy.proxy(Api, Proxy.method(Api.getInstance), [
    'routes'
]);


//-------------------------------------------------------------------------------
// Exports
//-------------------------------------------------------------------------------

export default Api;
