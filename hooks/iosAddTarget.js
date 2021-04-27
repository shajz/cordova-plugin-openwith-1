const fs = require('fs');
const path = require('path');

const {
  iosFolder,
  getPreferences,
  findXCodeproject,
  replacePreferencesInFile,
  log,
} = require('./utils');

// Return the list of files in the share extension project, organized by type
const FILE_TYPES = {
  '.h': 'source',
  '.m': 'source',
  '.plist': 'config',
  '.entitlements': 'config',
};

function parsePbxProject(context, pbxProjectPath) {
  let xcode = require('xcode');
  log(`Parsing existing project at location: ${pbxProjectPath}…`);

  let pbxProject;

  if (context.opts.cordova.project) {
    pbxProject = context.opts.cordova.project.parseProjectFile(context.opts.projectRoot).xcode;
  } else {
    pbxProject = xcode.project(pbxProjectPath);
    pbxProject.parseSync();
  }

  return pbxProject;
}

function forEachShareExtensionFile(context, callback) {
  let shareExtensionFolder = path.join(iosFolder(context), 'ShareExtension');
  fs.readdirSync(shareExtensionFolder).forEach((name) => {
    // Ignore junk files like .DS_Store
    if (!/^\..*/.test(name)) {
      callback({
        name: name,
        path: path.join(shareExtensionFolder, name),
        extension: path.extname(name),
      });
    }
  });
}

function getShareExtensionFiles(context) {
  let files = {source: [], config: [], resource: []};

  forEachShareExtensionFile(context, (file) => {
    let fileType = FILE_TYPES[file.extension] || 'resource';
    files[fileType].push(file);
  });

  return files;
}

module.exports = function(context) {
  log('Adding ShareExt target to XCode project');

  let deferral = require('q').defer();

  findXCodeproject(context, (projectFolder, projectName) => {
    let preferences = getPreferences(context, projectName);

    let pbxProjectPath = path.join(projectFolder, 'project.pbxproj');
    let pbxProject = parsePbxProject(context, pbxProjectPath);

    let files = getShareExtensionFiles(context);
    files.config.concat(files.source).forEach((file) => {
      replacePreferencesInFile(file.path, preferences);
    });

    // Find if the project already contains the target and group
    let target = pbxProject.pbxTargetByName('ShareExt') || pbxProject.pbxTargetByName('"ShareExt"');
    if (target) {
 log('ShareExt target already exists');
}

    if (!target) {
      // Add PBXNativeTarget to the project
      target = pbxProject.addTarget('ShareExt', 'app_extension', 'ShareExtension');

      // Add a new PBXSourcesBuildPhase for our ShareViewController
      // (we can't add it to the existing one because an extension is kind of an extra app)
      pbxProject.addBuildPhase([], 'PBXSourcesBuildPhase', 'Sources', target.uuid);

      // Add a new PBXResourcesBuildPhase for the Resources used by the Share Extension
      // (MainInterface.storyboard)
      pbxProject.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', target.uuid);
    }

    // Create a separate PBXGroup for the shareExtensions files, name has to be unique and path must be in quotation marks
    let pbxGroupKey = pbxProject.findPBXGroupKey({name: 'ShareExtension'});
    if (pbxGroupKey) {
      log('ShareExtension group already exists');
    } else {
      pbxGroupKey = pbxProject.pbxCreateGroup('ShareExtension', 'ShareExtension');

      // Add the PbxGroup to cordovas "CustomTemplate"-group
      let customTemplateKey = pbxProject.findPBXGroupKey({name: 'CustomTemplate'});
      pbxProject.addToPbxGroup(pbxGroupKey, customTemplateKey);
    }

    // Add files which are not part of any build phase (config)
    files.config.forEach((file) => {
      pbxProject.addFile(file.name, pbxGroupKey);
    });

    // Add source files to our PbxGroup and our newly created PBXSourcesBuildPhase
    files.source.forEach((file) => {
      pbxProject.addSourceFile(file.name, {target: target.uuid}, pbxGroupKey);
    });

    //  Add the resource file and include it into the targest PbxResourcesBuildPhase and PbxGroup
    files.resource.forEach((file) => {
      pbxProject.addResourceFile(file.name, {target: target.uuid}, pbxGroupKey);
    });

    // Add build settings for Swift support, bridging header and xcconfig files
    let configurations = pbxProject.pbxXCBuildConfigurationSection();
    for (let key in configurations) {
      if (typeof configurations[key].buildSettings !== 'undefined') {
        let buildSettingsObj = configurations[key].buildSettings;
        if (typeof buildSettingsObj['PRODUCT_NAME'] !== 'undefined') {
          let productName = buildSettingsObj['PRODUCT_NAME'];
          if (productName.indexOf('ShareExt') >= 0) {
            buildSettingsObj['CODE_SIGN_ENTITLEMENTS'] = '"ShareExtension/ShareExtension.entitlements"';
          }
        }
      }
    }

    // Write the modified project back to disc
    fs.writeFileSync(pbxProjectPath, pbxProject.writeSync());
    log('Successfully added ShareExt target to XCode project');

    deferral.resolve();
  });

  return deferral.promise;
};
