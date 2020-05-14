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
    "chartData": {
      "type": "boolean"
    }
  },
  "additionalProperties": false
}

class OutputInfoPlugin {
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

      if (this.options.chartData) {
        chartData = getChartData(stats.toJson(), outputPath, {})
        chartData = chartData ?  JSON.stringify(chartData) : null;
      }

      var result = {
        project: this.options.project,
        env: this.options.env || 'production',
        timestamp: Date.now(),
        assets,
        ...gitInfo,
        chartData
      }

      this.uploadBuild(result);

      callback && callback();
    });
  }

  uploadBuild (buildInfo) {
    const url = this.options.server + 'api/builds';
    return axios.post(url, buildInfo, { timeout: 3000 }).then(res => {
      if (res.data && res.data.status === 0) {
        console.log('Build info has been uploaded to Simple Bundle Monitor service.');
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

module.exports = OutputInfoPlugin;