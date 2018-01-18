'use strict'

const Promise = require('bluebird')
const fs = require('fs')
const path = require('path')
const fetch = require('node-fetch')
const gitBranch = require('git-branch')
const spawn = require('child-process-promise').spawn
const rimraf = require('rimraf')

class DependencyManager {
  constructor ({ defaultDependencies }) {
    this.defaultDependencies = defaultDependencies
    this.workDir = process.cwd()
    this.testDir = path.resolve(this.workDir, 'integration-test')
  }

  /**
   * Return the name of the hosting module.
   *
   * five-bells-integration-test is intended to be run as a dependency of a
   * specific five-bells module to be tested. This method returns the name of
   * that module, so that we can import the local copy rather than testing the
   * most recent stable version.
   *
   * @return {String} module name
   */
  getHostModuleName () {
    const packageJSON = require(path.resolve(this.workDir, 'package.json'))
    return packageJSON.name
  }

  /**
   * Determine the branch being tested.
   *
   * If a local copy or the master branch is being tested, this method returns
   * null.
   *
   * @return {String|null} Branch under test
   */
  getBranchNameUnderTest () {
    let branch = process.env.CIRCLE_BRANCH
    if (!branch) {
      try {
        branch = gitBranch.sync(this.workDir)
      } catch (e) {}
    }
    if (typeof branch !== 'string') return null
    else if (branch === 'master') return null
    else return branch
  }

  /**
   * Check if the branch under test exists for a given Five Bells dependency.
   *
   * @return {Promise<Boolean>} true if the branch exists, false otherwise
   */
  checkForBranchOnDependency (dependency) {
    const branch = this.getBranchNameUnderTest()
    if (!branch) return Promise.resolve(false)
    const repo = this.defaultDependencies[dependency]
    const url = `https://github.com/${repo}/tree/${branch}`
    return fetch(url).then((response) => response.status === 200)
  }

  /**
   * Return the package.json string with the correct testing dependencies.
   *
   * This function will calculate the correct dependencies for the integration
   * test. It will use the latest stable version for most modules, but it will
   * use the local version for the module-under-test.
   *
   * @return {String} stringified package.json
   */
  generateDummyPackageJSON (dependencyOverrides) {
    const packageDescriptor = {
      name: 'five-bells-integration-test-instance',
      private: true,
      dependencies: Object.assign(
        {'sqlite3': '~3.1.0'},
        this.defaultDependencies,
        dependencyOverrides
      )
    }

    const hostModule = this.getHostModuleName()
    if (packageDescriptor.dependencies[hostModule]) {
      // Local module is in the parent directory
      packageDescriptor.dependencies[hostModule] = 'file:../'
    }
    return JSON.stringify(packageDescriptor, null, 2)
  }

  /**
   * Prepare a test directory and install dependencies.
   *
   * This method will prepare a directory for the integration test by first
   * generating a package.json and then running the npm installation routine.
   */
  async install () {
    // Prepare test directory
    await spawn('rm', ['-rf', this.testDir])
    fs.mkdirSync(this.testDir)
    process.chdir(this.testDir)

    // Calculate dependency overrides based on git branches with same name
    const dependenciesToOverride = (await Promise.filter(
      Object.keys(this.defaultDependencies),
      this.checkForBranchOnDependency.bind(this)
    ))
    const dependencyOverrides = {}
    const branch = this.getBranchNameUnderTest()
    for (let dependency of dependenciesToOverride) {
      const repo = this.defaultDependencies[dependency]
      dependencyOverrides[dependency] = repo + '#' + branch
    }

    // Create package.json
    const dummyPackageJSONPath = path.resolve(this.testDir, 'package.json')
    const dummyPackageJSON = this.generateDummyPackageJSON(dependencyOverrides)
    fs.writeFileSync(dummyPackageJSONPath, dummyPackageJSON)

    // Install dependencies
    console.log('Installing dependencies:')
    await spawn('npm', ['install'], {stdio: 'inherit'})

    // Avoid that old versions of modules listed in this.defaultDependencies are used instead of the latest version
    // see https://github.com/interledgerjs/five-bells-integration-test/pull/58#issuecomment-274904951
    for (const depName in this.defaultDependencies) {
      rimraf.sync('node_modules/**/node_modules/' + depName)
    }
  }
}

exports.DependencyManager = DependencyManager
