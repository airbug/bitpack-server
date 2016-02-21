//-------------------------------------------------------------------------------
// Imports
//-------------------------------------------------------------------------------

import {
    Class,
    Obj,
    Proxy
} from 'bugcore';
import Config from 'config';
import FirebaseTokenGenerator from 'firebase-token-generator';


//-------------------------------------------------------------------------------
// Declare Class
//-------------------------------------------------------------------------------

/**
 * @class
 * @extends {Obj}
 */
const FirebaseTokenManager = Class.extend(Obj, {

    _name: 'bitrecipe.server.FirebaseTokenManager',


    //-------------------------------------------------------------------------------
    // Constructor
    //-------------------------------------------------------------------------------

    /**
     * @constructs
     */
    _constructor() {

        this._super();


        //-------------------------------------------------------------------------------
        // Private Properties
        //-------------------------------------------------------------------------------

        /**
         * @private
         * @type {string}
         */
        this.adminToken         = null;

        /**
         * @private
         * @type {FirebaseTokenGenerator}
         */
        this.tokenGenerator     = new FirebaseTokenGenerator(Config.get('firebaseSecret'));
    },


    //-------------------------------------------------------------------------------
    // Getters and Setters
    //-------------------------------------------------------------------------------

    /**
     * @return {string}
     */
    getAdminToken() {
        if (!this.isAdminTokenGenerated()) {
            this.generateAdminToken();
        }
        return this.adminToken;
    },


    //-------------------------------------------------------------------------------
    // Private Methods
    //-------------------------------------------------------------------------------

    /**
     * @private
     */
    generateAdminToken() {
        this.adminToken = this.tokenGenerator.createToken({
            uid: 'recipeserver'
        }, {
            admin: true,
            expires: ((new Date()).getTime() / 1000) + (60 * 60 * 24 * 30)
        });
    },

    /**
     * @private
     * @return {boolean}
     */
    isAdminTokenGenerated() {
        return this.adminToken !== null;
    }
});


//-------------------------------------------------------------------------------
// Private Static Properties
//-------------------------------------------------------------------------------

/**
 * @static
 * @private
 * @type {FirebaseTokenManager}
 */
FirebaseTokenManager.instance        = null;


//-------------------------------------------------------------------------------
// Static Methods
//-------------------------------------------------------------------------------

/**
 * @static
 * @return {FirebaseTokenManager}
 */
FirebaseTokenManager.getInstance = function() {
    if (FirebaseTokenManager.instance === null) {
        FirebaseTokenManager.instance = new FirebaseTokenManager();
    }
    return FirebaseTokenManager.instance;
};


//-------------------------------------------------------------------------------
// Static Proxy
//-------------------------------------------------------------------------------

Proxy.proxy(FirebaseTokenManager, Proxy.method(FirebaseTokenManager.getInstance), [
    'getAdminToken'
]);



//-------------------------------------------------------------------------------
// Exports
//-------------------------------------------------------------------------------

export default FirebaseTokenManager;
