//-------------------------------------------------------------------------------
// Imports
//-------------------------------------------------------------------------------

import {
    Class,
    Obj,
    Promises,
    Throwables,
    TypeUtil
} from 'bugcore';
import AWS from 'aws-sdk';
import express from 'express';
import {
    Firebase,
    PackPackage,
    PackVersionManager
    PublishKeyManager
} from 'bitpack';


//-------------------------------------------------------------------------------
// Declare Class
//-------------------------------------------------------------------------------

/**
 * @class
 * @extends {Obj}
 */
const Api = Class.extend(Obj, {

    _name: 'bitpack.routes.Api',


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
         * @type {BitPack}
         */
        this.bitPack        = null;

        /**
         * @private
         * @type {ContextChain}
         */
        this.contextChain   = null;

        /**
         * @private
         * @type {Router}
         */
        this.router         = null;
    },


    //-------------------------------------------------------------------------------
    // Getters and Setters
    //-------------------------------------------------------------------------------

    /**
     * @return {BitPack}
     */
    getBitPack() {
        return this.bitPack;
    },

    /**
     * @param {BitPack} bitPack
     */
    setBitPack(bitPack) {
        this.bitPack = bitPack;
    },

    /**
     * @return {ContextChain}
     */
    getContextChain() {
        return this.contextChain;
    },

    /**
     * @param {ContextChain} contextChain
     */
    setContextChain(contextChain) {
        this.contextChain = contextChain;
    },


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
                this.publishPack(authorization, request)
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
     * @return {PublishKeyEntity}
     */
    async loadPublishKey(key) {
        return await PublishKeyManager.get(this.contextChain, {key});
    },

    /**
     * @private
     * @param {string} packType
     * @param {string} packClass
     * @param {string} packScope
     * @param {string} packName
     * @param {string} versionNumber
     * @return {PackVersionEntity}
     */
    async loadPackVersion(packType, packClass, packScope, packName, versionNumber) {
        return await PackVersionManager.get(this.contextChain, {
            packClass,
            packName,
            packScope,
            packType,
            versionNumber
        });
    },

    /**
     * @private
     * @param {PublishKeyEntity} publishKeyEntity
     */
    async markPublishKeyUsed(publishKeyEntity) {
        await PublishKeyManager.update(this.contextChain, { key: publishKeyEntity.getKey() }, {
            usedAt: Firebase.timestamp()
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
     * @return {string}
     */
    parseAuthorization(authorization) {
        return authorization.split(' ')[1];
    },

    /**
     * @private
     * @param {string} authorization
     * @param {Stream} packPackageStream
     */
    async publishPack(authorization, packPackageStream) {
        if (!TypeUtil.isString(authorization)) {
            throw Throwables.exception('BAD_AUTHORIZATION', {}, 'Authorization not received');
        }
        const key = this.parseAuthorization(authorization);
        if (!TypeUtil.isString(key)) {
            throw Throwables.exception('BAD_AUTHORIZATION', {}, 'Publish key could not be parsed');
        }
        const publishKeyEntity = await this.loadPublishKey(key);
        this.validatePublishKey(publishKeyEntity);
        const publishKeyEntity = await this.markPublishKeyUsed(publishKeyEntity);

        // TODO PackServer
        // unpack stream to...
        // - validate pack name
        // - validate pack version

        const packPackage = await PackPackage.fromStream(packPackageStream);
        await this.validatePackPackage(publishKeyEntity, packPackage);
        const packVersionEntity = this.loadPackVersion(publishKeyEntity.getPackType(), publishKeyEntity.getPackClass(), publishKeyEntity.getPackScope(), publishKeyEntity.getPackName(), publishKeyEntity.getPackVersionNumber());
        this.validatePackVersion(packVersionEntity);
        const packUrl = await this.uploadPackPackage(publishKeyEntity, packPackage)
        return await PackVersionManager.updatePublished(publishKeyEntity.getPackName(), publishKeyEntity.getPackVersionNumber(), {
            published: true,
            packHash: packPackage.getPackHash(),
            packUrl: packUrl
        });
    },

    /**
     * @private
     * @param {PublishKeyEntity} publishKeyEntity
     * @param {PackPackage} packPackage
     * @return {Promise<string>}
     */
    uploadPackPackage(publishKeyEntity, packPackage) {
        return Promises.promise((resolve, reject) => {
            const s3Stream = require('s3-upload-stream')(new AWS.S3());
            const upload = s3Stream.upload({
                ACL: 'public-read',
                Bucket: 'gulp-pack',
                ContentType: 'application/x-compressed',
                Key: 'packs/' + publishKeyEntity.getPackType() + '/' + publishKeyEntity.getPackScope() + '/'
                    + publishKeyEntity.getPackName() + '/' + publishKeyEntity.getPackVersionNumber() + '/' +
                    publishKeyEntity.getPackType() + '-' + publishKeyEntity.getPackScope() + '-' +
                    publishKeyEntity.getPackName() + '-' + publishKeyEntity.getPackVersionNumber() + '.tgz',
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

            packPackage.getPackStream().pipe(upload);
        });
    },

    /**
     * @private
     * @param {PublishKeyEntity} publishKeyEntity
     * @return {PublishKeyEntity}
     */
    validatePublishKey(publishKeyEntity) {
        if (!publishKeyEntity) {
            throw Throwables.exception('BadAuthorization', {}, 'Could not find PublishKey');
        }
        if (publishKeyEntity.getUsedAt()) {
            throw Throwables.exception('BadAuthorization', {}, 'Publish key has already been used');
        }
    },

    /**
     * @private
     * @param {PublishKeyEntity} publishKeyEntity
     * @param {PackPackage} packPackage
     */
    validatePackPackage(publishKeyEntity, packPackage) {
        if (packPackage.getPackHash() !== publishKeyEntity.getPackHash()) {
            throw Throwables.exception('BadPackage', {}, 'Package hash does not match publish data');
        }
    },

    /**
     * @private
     * @param {PackVersionEntity} packVersionEntity
     */
    validatePackVersion(packVersionEntity) {
        if (packVersionEntity.getPublished()) {
            throw Throwables.exception('RecipeAlreadyPublished', {}, 'A pack has already been published for this version');
        }
    }
});


//-------------------------------------------------------------------------------
// Exports
//-------------------------------------------------------------------------------

export default Api;
