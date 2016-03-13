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
import {
    BitPack,
    Firebase,
    PublishKeyManager
} from 'bitpack';
import Api from './routes/Api';
import FirebaseTokenManager from './firebase/FirebaseTokenManager';


//-------------------------------------------------------------------------------
// Declare Class
//-------------------------------------------------------------------------------

/**
 * @class
 * @extends {Obj}
 */
const BitPackServer = Class.extend(Obj, {

    _name: 'bitpack.BitPackServer',


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
         * @type {Api}
         */
        this.api            = new Api();

        //TODO BRN: Fix this, should be able to handle multiple types of bitpacks
        /**
         * @private
         * @type {BitPack}
         */
        this.bitPack        = new BitPack('recipe');

        /**
         * @private
         * @type {ContextChain}
         */
        this.contextChain   = null;
    },



    //-------------------------------------------------------------------------------
    // Init Methods
    //-------------------------------------------------------------------------------

    /**
     * @return {BitPackServer}
     */
    init() {
        const _this = this._super();
        if (_this) {
            this.context();
            _this.api
                .setBitPack(_this.bitPack)
                .setContextChain(this.contextChain);
        }
        return _this;
    },


    //-------------------------------------------------------------------------------
    // Public Methods
    //-------------------------------------------------------------------------------

    /**
     *
     */
    async start() {
        try {
            const adminToken = FirebaseTokenManager.getAdminToken();
            AWS.config.update(Config.get('aws'));
            this.bitPack.getConfigController().setConfigOverride('firebaseUrl', Config.get('firebaseUrl'));
            await Firebase.authWithCustomToken(this.contextChain, adminToken);
            this.disableCaches();
            this.setupApp();
        } catch(error) {
            console.log('error occurred on startup', error);
            console.log(error.stack);
            process.exit(1);
        }
    },


    //-------------------------------------------------------------------------------
    // Private Methods
    //-------------------------------------------------------------------------------

    context() {
        this.contextChain = this.bitPack.getContextController().generateContextChain();
        this.bitPack.getContextController().establishPackTypeContext(this.contextChain, {
            packType: this.bitPack.getPackType()
        });
        this.bitPack.getContextController().establishFirebaseContext(this.contextChain, {
            firebaseUrl: Config.get('firebaseUrl')
        });
        this.bitPack.getContextController().establishExecContext(this.contextChain, {
            execPath: '.',
            target: 'user'
        });
        this.bitPack.getContextController().establishUserContext(this.contextChain, { userId: 'bitRecipeServer'});
    },

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
        app.use('/', this.api.routes());
        app.listen(4000, () => {
            console.log('BitPackServer listening on port 4000!');
        });
    }
});


//-------------------------------------------------------------------------------
// Private Static Properties
//-------------------------------------------------------------------------------

/**
 * @static
 * @private
 * @type {BitPackServer}
 */
BitPackServer.instance        = null;


//-------------------------------------------------------------------------------
// Static Methods
//-------------------------------------------------------------------------------

/**
 * @static
 * @return {BitPackServer}
 */
BitPackServer.getInstance = function() {
    if (BitPackServer.instance === null) {
        BitPackServer.instance = new BitPackServer();
    }
    return BitPackServer.instance;
};


//-------------------------------------------------------------------------------
// Static Proxy
//-------------------------------------------------------------------------------

Proxy.proxy(BitPackServer, Proxy.method(BitPackServer.getInstance), [
    'start'
]);


//-------------------------------------------------------------------------------
// Exports
//-------------------------------------------------------------------------------

export default BitPackServer;
