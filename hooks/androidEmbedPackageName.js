const ACTIVITY_PATH =
  './platforms/android/app/src/main/java/com/missiveapp/openwith/OpenWithActivity.java';

const fs = require('fs');

const {redError} = require('./utils');

module.exports = function(context) {
  let deferral = require('q').defer();

  let parser = context.requireCordovaModule('cordova-common').ConfigParser;
  let config = new parser('config.xml');
  let packageName = config.android_packageName() || config.packageName();

  fs.readFile(ACTIVITY_PATH, 'utf8', (err, data) => {
    if (err) {
      throw redError(err.message);
    }

    let result = data.replace(/##ANDROID_PACKAGE_NAME##/g, packageName);

    fs.writeFile(ACTIVITY_PATH, result, 'utf8', (err) => {
      if (err) {
        throw redError(err.message);
      }
      deferral.resolve();
    });
  });

  return deferral.promise;
};
