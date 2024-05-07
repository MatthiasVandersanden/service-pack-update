const core = require('@actions/core');
const github = require('@actions/github');
const fs = require('fs');
const path = require('path');

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

function parseUpdate(up) {
  if (/up\d\.\d$/.test(up)) {
    return {
      min: parseInt(up[4]),
      maj: parseInt(up[2])
    }
  }

  if (/up\d$/.test(up)) {
    return {
      min: 0,
      maj: parseInt(up[2])
    }
  }
  
  return null;
}

function updateToString(up) {
  return `up${up.maj}.${up.min}`
}

function parseBranch(branch) {
  if (branch === undefined || branch === null || branch.length === 0) {
    core.info("Branch is undefined or empty")
    return {
      year: null, 
      update: null
    };
  }

  if (!/refs\/heads\/\d\d\d\d(-up\d(\.\d)?)?(-.*)?/.test(branch) && !/refs\/heads\/\d\d\d\d(-sp\d(\.\d)?)?(-.*)?/.test(branch)) {
    core.info(`Incorrect branch format: ${branch}`);
    return {
      year: null, 
      update: null
    };
  }

  branch = branch.slice('refs/heads/'.length);
  core.info(`Branch name: ${branch}`);

  if (/\d\d\d\d-up\d(\.\d)?(-.*)?/.test(branch)) {
    let year = parseInt(branch.substr(0, 4));
    if (year === NaN || year < 2000 || year > 9999) {
      core.info(`Incorrect year: ${error.message}`);
      return {
        year: null, 
        update: null
      }; 
    }
    
    let up = branch.substr(5);
    if (/up\d\.\d(-.*)?/.test(up)) {
      core.info("Detect minor service pack");
      let maj = parseInt(up[2]);
      let min = parseInt(up[4]);
      let update = {maj, min};
      return {
        year,
        update
      };
    }

    if (/up\d(-.*)?/.test(up)) {
      core.info("Detect major service pack");
      let maj = parseInt(up[2]);
      let min = 0;
      let update = {maj, min};
      return {
        year,
        update
      };
    }

    core.info("Branch could not be matched")
    return {
      year: null,
      update: null
    };
  }

  if (/\d\d\d\d(-.*)?/.test(branch)) {
    core.info("Single year branch detected");
    let year = parseInt(branch.substr(0, 4));
    if (year === NaN || year < 2000 || year > 9999) {
      core.info(`Incorrect year: ${year}`);
      return {
        year: null, 
        update: null
      }; 
    }

    return {
      year,
      update: null
    };
  }

  core.info("Branch could not be matched")
  return {
    year: null,
    update: null
  }
}

function updateConfig(config, branch) {
  let cy = config.year;
  let cup = parseUpdate(config.update);
  let by = branch.year;
  let bup = branch.update;

  if (cy === null || cup === null) {
    core.info(`Config does not contain year or service pack`);
    return null;
  }

  let sameYear = by === null || (by !== null && cy === by);
  let sameUp = bup === null || (bup !== null && cup.min === bup.min && cup.max === bup.max);
  if (sameYear && sameUp) {
    core.info("No change detected, keeping original config");
    return null;
  }

  if (!sameYear) {
    core.info(`New year detected: updating config with year: ${by}`);
    config.year = by;
  }

  if (!sameUp) {
    let update = updateToString(bup);
    core.info(`New service pack detected: updating config with update: ${update}`);
    config.update = update;
  }

  return config;
}

async function commitUpdate(config, GITHUB_SHA) {
  try {
    let data = JSON.stringify(config);
    const path = core.getInput('path');
    core.info(`Writing config: ${data} at ${path}`);
    fs.writeFileSync(path, data, 'utf8');

    core.setOutput("updated", true);
  } catch(error) {
    core.info(`Write failed: ${error.message}`);
  }
}

async function action() {
  core.setOutput("updated", false);

  const { GITHUB_REF, GITHUB_SHA } = process.env;
  
  if (!GITHUB_REF) {
    core.setFailed('Missing GITHUB_REF.');
    return;
  }
  
  let config = getConfig();
  if (config === null) {
    core.info(`Config not found`);
    return;
  }

  let branch = parseBranch(GITHUB_REF);
  
  core.info("Starting update.");
  let updatedConfig = updateConfig(config, branch);
  if (updatedConfig !== null) {
    commitUpdate(updatedConfig, GITHUB_SHA);
  }

  core.info("Finished update");

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
