var validateOptions = require('schema-utils');
var execSync = require('child_process').execSync;
var axios = require('axios');
var getViewerData = require('webpack-bundle-analyzer/lib/analyzer').getViewerData;
var _ = require('lodash');

const FileSizeReporter = require('./FileSizeReporter');
getFileInfoAfterBuild = FileSizeReporter.getFileInfoAfterBuild;

function removeEmptyLines (string) {
  return string.replace(/[\s\r\n]+$/, '')
}

function runGitCommand (command) {
  return removeEmptyLines(execSync(command).toString())
}

function getGitInfo () {
  return {
    branch: runGitCommand('git rev-parse --abbrev-ref HEAD'),
    version: runGitCommand('git describe --always'),
    commit: runGitCommand('git rev-parse HEAD')
  }
}

const schema = {
  "type": "object",
  "properties": {
    "project": {
      "type": "string"
    },
    "env": {
      "type": "string"
    },
    "server": {
      "type": "string"
    },
    "api_token": {
      "type": "string"
    },
    "enableChart": {
      "type": "boolean"
    }
  },
  "additionalProperties": false
}

class SimpleBundleMonitorPlugin {
  constructor (options = { chartData: false }) {
    validateOptions(schema, options);
    this.options = options;
  }

  apply(compiler) {
    compiler.hooks.done.tap('OutputInfoPlugin', (stats, callback) => {
      var outputPath = compiler.options.output.path;

      var assets = getFileInfoAfterBuild(stats, outputPath);
      var gitInfo = getGitInfo();
      var chartData = '';

      if (this.options.enableChart) {
        chartData = getChartData(stats.toJson(), outputPath, {})
        chartData = chartData ? JSON.stringify(chartData) : null;
      }

      var result = {
        project: this.options.project,
        env: this.options.env || 'production',
        timestamp: Date.now(),
        assets,
        ...gitInfo,
        chartData,
        token: this.options.api_token
      }

      this.uploadBuild(result);
      callback && callback();
    });
  }

  uploadBuild (buildInfo) {
    const url = this.options.server + 'api/builds';
    return axios.post(url, buildInfo, { timeout: 10000 }).then(res => {
      if (res.data && res.data.status === 0) {
        console.log('Build info has been uploaded to Simple Bundle Monitor service.');
        console.log(this.options.server, '\n')
      }
    }).catch(err => {
      console.error('Simple Bundle Monitor upload failed.')
      if (err.response && err.response.status === 401) {
        console.error(err.response.data.error || 'Wrong token');
      } else if (err.response) {
        console.error(err.response.status)
      } else if (err.request) {
        console.error('request error')
      } else {
        console.error(err.message)
      }
    })
  }
}

function getChartData(bundleStats, bundleDir, analyzerOpts) {
  let chartData;

  try {
    chartData = getViewerData(bundleStats, bundleDir, analyzerOpts);
  } catch (err) {
    chartData = null;
  }

  if (_.isPlainObject(chartData) && _.isEmpty(chartData)) {
    chartData = null;
  }

  return chartData;
}

module.exports = SimpleBundleMonitorPlugin;