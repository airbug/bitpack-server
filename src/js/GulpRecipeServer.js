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
import GulpRecipe from 'gulp-recipe';
import Api from './routes/Api';
import FirebaseTokenManager from './firebase/FirebaseTokenManager';


//-------------------------------------------------------------------------------
// Simplify References
//-------------------------------------------------------------------------------

const {
    Firebase
} = GulpRecipe.util;


//-------------------------------------------------------------------------------
// Declare Class
//-------------------------------------------------------------------------------

/**
 * @class
 * @extends {Obj}
 */
const GulpRecipeServer = Class.extend(Obj, {

    _name: 'recipe.GulpRecipeServer',


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
    setupApp() {
        const app = express();
        app.use('/', Api.routes());
        app.listen(3000, () => {
            console.log('Example app listening on port 3000!');
        });
    }
});


//-------------------------------------------------------------------------------
// Private Static Properties
//-------------------------------------------------------------------------------

/**
 * @static
 * @private
 * @type {GulpRecipeServer}
 */
GulpRecipeServer.instance        = null;


//-------------------------------------------------------------------------------
// Static Methods
//-------------------------------------------------------------------------------

/**
 * @static
 * @return {GulpRecipeServer}
 */
GulpRecipeServer.getInstance = function() {
    if (GulpRecipeServer.instance === null) {
        GulpRecipeServer.instance = new GulpRecipeServer();
    }
    return GulpRecipeServer.instance;
};


//-------------------------------------------------------------------------------
// Static Proxy
//-------------------------------------------------------------------------------

Proxy.proxy(GulpRecipeServer, Proxy.method(GulpRecipeServer.getInstance), [
    'start'
]);


//-------------------------------------------------------------------------------
// Exports
//-------------------------------------------------------------------------------

export default GulpRecipeServer;
