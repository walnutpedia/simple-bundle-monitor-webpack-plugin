/**
 * Original code belongs to Facebook, Inc.
 * Modified by walnutpedia
 */

'use strict';

var fs = require('fs');
var path = require('path');
var gzipSize = require('gzip-size').sync;

function canReadAsset(asset) {
  return (
    /\.(js|css)$/.test(asset) &&
    !/service-worker\.js/.test(asset) &&
    !/precache-manifest\.[0-9a-f]+\.js/.test(asset)
  );
}

// Prints a detailed summary of build files.
function getFileInfoAfterBuild(
  webpackStats,
  buildFolder
) {
  var assets = (webpackStats.stats || [webpackStats])
    .map(stats => {
      return stats
        .toJson({ all: false, assets: true })
        .assets.filter(asset => canReadAsset(asset.name))
        .map(asset => {
          var fileContents = fs.readFileSync(path.join(buildFolder, asset.name));
          var gzippedSize = gzipSize(fileContents);
          var fileStats = fs.statSync(path.join(buildFolder, asset.name));
          var size = fileStats.size
          return {
            folder: path.dirname(asset.name),
            name: path.basename(asset.name),
            gzippedSize,
            size
          };
        })
      }
    )
    .reduce((single, all) => all.concat(single), []);
  assets.sort((a, b) => b.size - a.size);

  return assets;
}

function removeFileNameHash(buildFolder, fileName) {
  return fileName
    .replace(buildFolder, '')
    .replace(/\\/g, '/')
    .replace(
      /\/?(.*)(\.[0-9a-f]+)(\.chunk)?(\.js|\.css)/,
      (match, p1, p2, p3, p4) => p1 + p4
    );
}

module.exports = {
  getFileInfoAfterBuild: getFileInfoAfterBuild,
};