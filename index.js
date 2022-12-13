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

function servicePackToString(sp) {
  return sp.min === 0 ? `sp${sp.maj}` : `sp${sp.maj}.${sp.min}`
}

function parseBranch(branch) {
  if (branch === undefined || branch === null || branch.length === 0) {
    core.info("Branch is undefined or empty")
    return null;
  }

  if (!branch.startsWith('refs/heads/')) {
    core.info(`Not dealing with a branch: ${branch}`);
    return null;
  }

  branch = branch.splice('refs/heads/'.length);
  core.info(`Branch name: ${branch}`);

  let parts = branch.split("-");
  if (parts.length === 1) {
    // Single year branch, change year only
    try {
      let year = parseInt(parts[0]);
      core.info(`Detected single year branch: ${year}`);

      return {
        year,
        sp: null
      };
    } catch(error) {
      // Unrecognized format
      core.info(`Unrecognized branch format: ${error.message}`);
      return {
        year: null, 
        sp: null
      };
    }
  } else {
    // Year and service pack branch
    try {
      let year = parseInt(parts[0]);
      let sp = parseServicePack(parts[1]);

      if (sp === null) {
        // Only detected year
        core.info(`Detected year in branch: ${year}`);
        return {
          year,
          sp: null
        };
      }

      return {
        year,
        sp
      };
    } catch(error) {
      core.info(`Unrecognized branch format: ${error.message}`);
      return {
        year: null, 
        sp: null
      };
    }
  }
}

function updateConfig(config, cy, csp, by, bsp) {
  if (cy === null || csp === null) {
    core.info(`Config does not contain year or service pack`);
    return null;
  }

  if (cy === by && csp.min === bsp.min && csp.max === bsp.max) {
    core.info("No change detected, keeping original config");
    return null;
  }

  if (by !== null) {
    core.info(`New year detected: updating config with year: ${by}`);
    config.year = by;
  }

  if (bsp != null) {
    let servicePack = servicePackToString(bsp);
    core.info(`New service pack detected: updating config with servicePack: ${servicePack}`);
    config.servicePack = servicePack;
  }

  return config;
}

async function commitUpdate(config, GITHUB_SHA) {
  try {
    let data = JSON.stringify(config);
    const path = core.getInput('path');
    core.info(`Writing config: ${data} at ${path}`);
    fs.writeFileSync(path, data, 'utf8');

    core.setOutput('Updated', true);

  } catch(error) {
    core.info(`Write failed: ${error.message}`);
  }
}

async function action() {
  core.setOutput('Updated', false);
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

  let configYear = config["year"];
  let configSp = parseServicePack(config["servicePack"]);
  let { branchYear, branchSp } = parseBranch(GITHUB_REF);
  
  core.info("Starting update.");
  let updatedConfig = updateConfig(config, configYear, configSp, branchYear, branchSp);
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