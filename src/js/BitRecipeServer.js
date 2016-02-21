//-------------------------------------------------------------------------------
// Imports
//-------------------------------------------------------------------------------

import {
    Class,
    Obj,
    Proxy
} from 'bugcore';
import AWS from 'aws-sdk';
import Config from 'config';
import express from 'express';
import GulpRecipe, {
    managers,
    util
} from 'gulp-recipe';
import Api from './routes/Api';
import FirebaseTokenManager from './firebase/FirebaseTokenManager';


//-------------------------------------------------------------------------------
// Simplify References
//-------------------------------------------------------------------------------

const {
    PublishKeyManager
} = managers;
const {
    Firebase
} = util;


//-------------------------------------------------------------------------------
// Declare Class
//-------------------------------------------------------------------------------

/**
 * @class
 * @extends {Obj}
 */
const BitRecipeServer = Class.extend(Obj, {

    _name: 'bitrecipe.BitRecipeServer',


    //-------------------------------------------------------------------------------
    // Public Methods
    //-------------------------------------------------------------------------------

    /**
     *
     */
    start() {
        return GulpRecipe.context({})
            .then(() => {
                const adminToken = FirebaseTokenManager.getAdminToken();
                AWS.config.update(Config.get('aws'));
                return Firebase.authWithCustomToken(adminToken);
            })
            .then(() => {
                this.disableCaches();
                this.setupApp();
            })
            .catch((error) => {
                console.log('error occurred on startup', error);
                console.log(error.stack);
                process.exit(1);
            });
    },


    //-------------------------------------------------------------------------------
    // Private Methods
    //-------------------------------------------------------------------------------

    /**
     * @private
     */
    disableCaches() {
        PublishKeyManager.disableCache();
    },

    /**
     * @private
     */
    setupApp() {
        const app = express();
        app.use('/', Api.routes());
        app.listen(4000, () => {
            console.log('BitRecipeServer listening on port 4000!');
        });
    }
});


//-------------------------------------------------------------------------------
// Private Static Properties
//-------------------------------------------------------------------------------

/**
 * @static
 * @private
 * @type {BitRecipeServer}
 */
BitRecipeServer.instance        = null;


//-------------------------------------------------------------------------------
// Static Methods
//-------------------------------------------------------------------------------

/**
 * @static
 * @return {BitRecipeServer}
 */
BitRecipeServer.getInstance = function() {
    if (BitRecipeServer.instance === null) {
        BitRecipeServer.instance = new BitRecipeServer();
    }
    return BitRecipeServer.instance;
};


//-------------------------------------------------------------------------------
// Static Proxy
//-------------------------------------------------------------------------------

Proxy.proxy(BitRecipeServer, Proxy.method(BitRecipeServer.getInstance), [
    'start'
]);


//-------------------------------------------------------------------------------
// Exports
//-------------------------------------------------------------------------------

export default BitRecipeServer;
