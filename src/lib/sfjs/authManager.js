import {Platform} from 'react-native';
import KeysManager from "@Lib/keysManager"
import Storage from '@SFJS/storageManager'
import Server from '@SFJS/httpManager'
import AlertManager from '@SFJS/alertManager'

export default class Auth extends SFAuthManager {

  static instance = null;
  static get() {
    if(this.instance == null) {
      this.instance = new Auth(Storage.get(), Server.get(), AlertManager.get());
    }
    return this.instance;
  }

  defaultServer() {
    return "https://sync.standardnotes.org";
  }

  serverUrl() {
    let user = KeysManager.get().user;
    return (user && user.server) || this.defaultServer();
  }

  offline() {
    let keys = KeysManager.get().activeKeys() || {};
    return !keys.jwt;
  }

  async signout(clearAllData) {
    await Storage.get().clearAllModels();
    await KeysManager.get().clearAccountKeysAndData();
    this._keys = null;
    // DONT clear all data. We will do this ourselves manually, as we need to preserve certain data keys.
    return super.signout(false);
  }

  async keys() {
    // AuthManager only handles account related keys. If we are requesting keys,
    // we are referring to account keys. KeysManager.activeKeys can return local passcode
    // keys.
    if(this.offline()) {
      return null;
    }

    return KeysManager.get().activeKeys();
  }

  async getAuthParams() {
    return KeysManager.get().activeAuthParams();
  }

  async handleAuthResponse(response, email, url, authParams, keys) {
    // We don't want to call super, as the super implementation is meant for web credentials
    // super will save keys to storage, which we don't want.
    // await super.handleAuthResponse(response, email, url, authParams, keys);
    try {
      this._keys = keys;
      return Promise.all([
        KeysManager.get().persistAccountKeys(_.merge(keys, {jwt: response.token})),
        KeysManager.get().setAccountAuthParams(authParams),
        KeysManager.get().saveUser({server: url, email: email})
      ]);
    } catch(e) {
      console.log("Error saving auth paramters", e);
      return null;
    }
  }

  async verifyAccountPassword(password) {
    let authParams = await this.getAuthParams();
    let keys = await SFJS.crypto.computeEncryptionKeysForUser(password, authParams);
    let success = keys.mk === (await this.keys()).mk;
    return success;
  }
}
