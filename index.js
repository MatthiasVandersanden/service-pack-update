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
    return {
      year: null, 
      servicePack: null
    };
  }

  if (!branch.startsWith('refs/heads/')) {
    core.info(`Not dealing with a branch: ${branch}`);
    return {
      year: null, 
      servicePack: null
    };
  }

  branch = branch.slice('refs/heads/'.length);
  core.info(`Branch name: ${branch}`);

  let parts = branch.split("-");
  if (parts.length === 1) {
    // Single year branch, change year only
    try {
      let year = parseInt(parts[0]);
      if (year < 2000 || year > 9999) {
        throw Error();
      }

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
        servicePack: null
      };
    }
  } else {
    // Year and service pack branch
    try {
      let year = parseInt(parts[0]);
      if (year < 2000 || year > 9999) {
        throw Error();
      }

      let servicePack = parseServicePack(parts[1]);
      if (servicePack === null) {
        // Only detected year
        core.info(`Detected year in branch: ${year}`);
        return {
          year,
          servicePack: null
        };
      }

      return {
        year,
        servicePack
      };
    } catch(error) {
      core.info(`Unrecognized branch format: ${error.message}`);
      return {
        year: null, 
        servicePack: null
      };
    }
  }
}

function updateConfig(config, branch) {
  let cy = config.year;
  let csp = parseServicePack(config.servicePack);
  let by = branch.year;
  let bsp = branch.servicePack;

  if (cy === null || csp === null) {
    core.info(`Config does not contain year or service pack`);
    return null;
  }

  let sameYear = by === null || (by !== null && cy === by);
  let sameSp = bsp === null || (bsp !== null && csp.min === bsp.min && csp.max === bsp.max);
  if (sameYear && sameSp) {
    core.info("No change detected, keeping original config");
    return null;
  }

  if (!sameYear) {
    core.info(`New year detected: updating config with year: ${by}`);
    config.year = by;
  }

  if (!sameSp) {
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

  let b = parseBranch(GITHUB_REF);
  
  core.info("Starting update.");
  let updatedConfig = updateConfig(config, b);
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