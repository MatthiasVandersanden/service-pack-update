const core = require('@actions/core');
const github = require('@actions/github');
const fs = require('fs');

const token = core.getInput("token");
const octokit = github.getOctokit(token);

function getConfig() {
  const path = core.getInput('path');
  core.info(`Reading config at ${path}`);

  try {
    const data = fs.readFileSync(path);
    let config = JSON.parse(data);
    core.info(`Read config: ${JSON.stringify(config)}`);

    return config;
  } catch (error) {
    core.info(error.message);
    return null;
  }
}

function parseServicePack(sp) {
  if (!sp.startsWith("sp")) {
    core.info("Incorrect service pack: " + sp);
    return null;
  }

  let parts = sp.split('.');
  let maj = parseInt(parts[0].substr(2, parts[0].length - 1));
  let min = parts.length === 1 ? 0 : parseInt(parts[1]);

  return {
    maj,
    min
  };
}

function parseTag(tag) {
  try {
    if (tag === undefined || tag === null || tag.length === 0) {
      core.info("Tag is undefined or empty")
      return null;
    }
  
    if (!tag.startsWith('v')) {
      core.info("Incorrect tag syntax: tags should start with a lowercase v");
      return null;
    }
  
    let parts = tag.split(".");
    if (parts.length !== 3 && parts.length !== 4) {
      core.info("Incorrect tag syntax: tags have three parts: a year, sp version and a count");
      return null;
    }
  
    let year = parseInt(parts[0].substr(1, parts[0].length - 1));
    if (year < 2000 || year > 3000) {
      core.info("Incorrect year: " + year);
      return null;
    }
  
    let sp = parseServicePack(parts.length === 3 ? parts[1] : `${parts[1]}.${parts[2]}`);
    if (sp === null) {
      return null;
    }

    let count = parseInt(parts[parts.length - 1]);
    if (count < 0) {
      core.info(`Incorrect tag syntax: the counter should be positive (was ${count})`);
      return null;
    }
  
    return { year, sp, count };
  } catch (error) {
    return null;
  }
}

function compareTags(a, b) {
  if (a.year !== b.year) {
    return a.year - b.year;
  }

  if (a.sp.maj !== b.sp.maj) {
    return a.sp.maj - b.sp.maj;
  }

  if (a.sp.min !== b.sp.min) {
    return a.sp.min - b.sp.min;
  }

  if (a.count !== b.count) {
    return a.count - b.count;
  }

  return 0;
}

async function action() {
  const { GITHUB_REF, GITHUB_SHA } = process.env;
  
  if (!GITHUB_REF) {
    core.setFailed('Missing GITHUB_REF.');
    return;
  }
  
  if (!GITHUB_SHA) {
    core.setFailed('Missing GITHUB_SHA.');
    return;
  }
  
  const config = getConfig();
  if (config === null) {
    core.setOutput('tag', undefined);
    return;
  }
  
  core.info("Starting update.");

  core.info(GITHUB_REF);

  return 
}

async function run() {
  try {
    await action();
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();