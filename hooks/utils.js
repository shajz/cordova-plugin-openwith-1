const fs = require('fs');
const path = require('path');

const PLUGIN_ID = 'cordova-plugin-openwith-shajz';
const BUNDLE_SUFFIX = '.shareextension';

function getPreferences(context, projectName) {
  let configXml = getConfigXml(context);
  let plist = projectPlistJson(context, projectName);

  return [{
    key: '__DISPLAY_NAME__',
    value: getCordovaParameter(configXml, 'DISPLAY_NAME') || projectName,
  }, {
    key: '__BUNDLE_IDENTIFIER__',
    value: getCordovaParameter(configXml, 'IOS_BUNDLE_IDENTIFIER') + BUNDLE_SUFFIX,
  }, {
    key: '__BUNDLE_SHORT_VERSION_STRING__',
    value: plist.CFBundleShortVersionString,
  }, {
    key: '__BUNDLE_VERSION__',
    value: plist.CFBundleVersion,
  }, {
    key: '__URL_SCHEME__',
    value: getCordovaParameter(configXml, 'IOS_URL_SCHEME'),
  }];
}

function getConfigXml(context) {
  let configXml = fs.readFileSync(path.join(context.opts.projectRoot, 'config.xml'), 'utf-8');

  if (configXml) {
    configXml = configXml.substring(configXml.indexOf('<'));
  }

  return configXml;
}

function projectPlistJson(context, projectName) {
  let plist = require('plist');

  let plistPath = path.join(iosFolder(context), projectName, `${projectName}-Info.plist`);
  return plist.parse(fs.readFileSync(plistPath, 'utf8'));
}

function iosFolder(context) {
  return context.opts.cordova.project
    ? context.opts.cordova.project.root
    : path.join(context.opts.projectRoot, 'platforms/ios/');
}

function getCordovaParameter(configXml, variableName) {
  let variable;
  let arg = process.argv.filter((arg) => arg.indexOf(`${variableName}=`) === 0);

  if (arg.length >= 1) {
    variable = arg[0].split('=')[1];
  } else {
    variable = getPreferenceValue(configXml, variableName);
  }

  return variable;
}

function getPreferenceValue(configXml, name) {
  let value = configXml.match(new RegExp(`name="${name}" value="(.*?)"`, 'i'));

  if (value && value[1]) {
    return value[1];
  } else {
    return null;
  }
}

// Determine the full path to the app's xcode project file.
function findXCodeproject(context, callback) {
  fs.readdir(iosFolder(context), (err, data) => {
    let projectFolder;
    let projectName;

    // Find the project folder by looking for *.xcodeproj
    if (data && data.length) {
      data.forEach((folder) => {
        if (folder.match(/\.xcodeproj$/)) {
          projectFolder = path.join(iosFolder(context), folder);
          projectName = path.basename(folder, '.xcodeproj');
        }
      });
    }

    if (!projectFolder || !projectName) {
      throw redError(`Could not find an .xcodeproj folder in: ${iosFolder(context)}`);
    }

    if (err) {
      throw redError(err);
    }

    callback(projectFolder, projectName);
  });
}

function replacePreferencesInFile(filePath, preferences) {
  let content = fs.readFileSync(filePath, 'utf8');

  for (let i = 0; i < preferences.length; i++) {
      let pref = preferences[i];
      let regexp = new RegExp(pref.key, 'g');
      content = content.replace(regexp, pref.value);
  }

  fs.writeFileSync(filePath, content);
}

function redError(message) {
  return new Error(`"${PLUGIN_ID}" \x1b[1m\x1b[31m${message}\x1b[0m`);
}

function log(message) {
  console.log(`[${PLUGIN_ID}] ${message}`);
}

module.exports = {
  PLUGIN_ID,
  iosFolder,
  getPreferences,
  findXCodeproject,
  replacePreferencesInFile,
  log, redError,
};
