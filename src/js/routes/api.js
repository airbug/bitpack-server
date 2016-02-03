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
import Config from 'config';
import express from 'express';
import fs from 'fs';
import GulpRecipe from 'gulp-recipe';


//-------------------------------------------------------------------------------
// Simplify References
//-------------------------------------------------------------------------------

const {
    core,
    data,
    entities,
    util
} = GulpRecipe;


//-------------------------------------------------------------------------------
// Declare Class
//-------------------------------------------------------------------------------

/**
 * @class
 * @extends {Obj}
 */
const Api = Class.extend(Obj, {

    _name: 'recipe.routes.Api',


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
     * @return {Promise.<PublishKeyData>}
     */
    loadPublishKey(key) {
        return entities.PublishKey.get(key)
            .then((snapshot) => {
                if (snapshot.exists()) {
                    return new data.PublishKeyData(snapshot.val());
                }
            });
    },

    /**
     * @private
     * @param {PublishKeyData} publishKeyData
     */
    markPublishKeyUsed(publishKeyData) {
        return entities.PublishKey.update(publishKeyData.getKey(), {
            usedAt: util.Firebase.timestamp()
        }).then(() => {
            return publishKeyData;
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
            return this.validatePublishKey(publishKeyData);
        }).then((publishKeyData) => {
            return this.markPublishKeyUsed(publishKeyData);
        }).then((publishKeyData) => {
            //TODO TEST
            //const wstream = fs.createWriteStream(__dirname + '/out/test.tgz');
            //recipePackageStream.pipe(wstream);

            console.log('publishKeyData - recipeName:', publishKeyData.getRecipeName(), ' recipeHash:', publishKeyData.getRecipeHash());


            // TODO RecipeServer
            // validate tarball hash
            // validate recipe name
            // validate recipe version
            // validate recipeVersion has not already been published
            // name of file is [recipeName]-[recipeVersion].tgz
            // upload tarball to S3 at path [S3]/[recipeName]/[recipeVersion]/[recipeName]-[recipeVersion].tgz

            return core.RecipePackage.fromStream(recipePackageStream)
                .then((recipePackage) => {
                    return [publishKeyData, recipePackage];
                });
        }).then((results) => {
            const [publishKeyData, recipePackage] = results;
            this.validateRecipePackage(recipePackage, publishKeyData);
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
        return publishKeyData;
    },

    validateRecipePackage(recipePackage, publishKeyData) {

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
