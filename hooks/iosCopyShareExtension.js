const fs = require('fs');
const path = require('path');

const {
  PLUGIN_ID,
  getPreferences,
  findXCodeproject,
  replacePreferencesInFile,
  log, redError,
} = require('./utils');

function copyFileSync(source, target, preferences) {
  let targetFile = target;

  // If target is a directory a new file with the same name will be created
  if (fs.existsSync(target)) {
    if (fs.lstatSync(target).isDirectory()) {
      targetFile = path.join(target, path.basename(source));
    }
  }

  fs.writeFileSync(targetFile, fs.readFileSync(source));
  replacePreferencesInFile(targetFile, preferences);
}

function copyFolderRecursiveSync(source, target, preferences) {
  let files = [];

  // Check if folder needs to be created or integrated
  let targetFolder = path.join(target, path.basename(source));
  if (!fs.existsSync(targetFolder)) {
    fs.mkdirSync(targetFolder);
  }

  // Copy
  if (fs.lstatSync(source).isDirectory()) {
    files = fs.readdirSync(source);
    files.forEach((file) => {
      let curSource = path.join(source, file);
      if (fs.lstatSync(curSource).isDirectory()) {
        copyFolderRecursiveSync(curSource, targetFolder, preferences);
      } else {
        copyFileSync(curSource, targetFolder, preferences);
      }
    });
  }
}

module.exports = function(context) {
  log('Copying ShareExtension files to iOS project');

  let deferral = require('q').defer();

  findXCodeproject(context, (projectFolder, projectName) => {
    let preferences = getPreferences(context, projectName);

    let srcFolder = path.join(context.opts.projectRoot, 'plugins', PLUGIN_ID, 'src', 'ios', 'ShareExtension');
    let targetFolder = path.join(context.opts.projectRoot, 'platforms', 'ios');

    if (!fs.existsSync(srcFolder)) {
      throw redError(`Missing extension project folder in ${srcFolder}.`);
    }

    copyFolderRecursiveSync(srcFolder, targetFolder, preferences);
    deferral.resolve();
  });

  return deferral.promise;
};
