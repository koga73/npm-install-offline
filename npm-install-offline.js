/*
* npm-install-offline v1.1.0 Copyright (c) 2019 AJ Savino
* https://github.com/koga73/npm-install-offline
* MIT LICENSE
*/
const fs = require("fs-extra");
const crypto = require("crypto");
const {exec, execSync} = require("child_process");

const ERROR_INVALID_PARAM = "Invalid parameter - Must specify an [ npm directory | packageName + --repo directory ]";

class NpmInstallOffline {
	constructor(repoPaths){
		this.repoPaths = repoPaths || [];
		this.cache = null;
		this.cacheHash = null;
		this.production = false;
		this.localOnly = false;
		this.symlink = false;
		this.verbose = false;
	}

	//Resolves parameter which can be a packageName or a directory into a packageName
	//If directory will add it as a repo and return the package name
	resolvePackage(packageNameOrDir){
		if (this.verbose){
			console.log("Resolving packageName or directory:", packageNameOrDir);
		}
		var lStatDir = null;
		try {
			lStatDir = fs.lstatSync(packageNameOrDir);
		} catch (err){
			//nop
		}
		if (lStatDir){
			if (lStatDir.isDirectory()){
				var dir = packageNameOrDir.replace(/[\/\\]$/, "");
				var pkgDotJson = dir + "/package.json";
				try {
					fs.statSync(pkgDotJson);
				} catch (err){
					throw new Error(ERROR_INVALID_PARAM);
				}
				if (this.verbose){
					console.log("Resolved as directory:", packageNameOrDir);
				}
				var pkgJson = fs.readFileSync(pkgDotJson, "utf8");
				var pkgName = JSON.parse(pkgJson).name;
				this.addRepo(packageNameOrDir);
				return pkgName;
			} else {
				throw new Error(ERROR_INVALID_PARAM);
			}
		}
		if (this.verbose){
			console.log("Resolved as packageName:", packageNameOrDir);
		}
		return packageNameOrDir;
	}
	
	addRepo(repoPath){
		this.repoPaths.push(repoPath);
		this.repoPaths = this._filterDuplicates(this.repoPaths);
		var isDir = fs.lstatSync(repoPath).isDirectory();
		if (!isDir){
			throw new Error(ERROR_INVALID_PARAM);
		}
		if (this.verbose){
			console.log("Repo added:", repoPath);
		}
	}
	
	//Install packages from local repositories and npm if not --local-only
	//packageNames can be a string or array
	//Returns an object containing the found and missing packages
	async install(packageNames){
		//Build cache
		var cacheUpdated = await this.buildCache();
		if (cacheUpdated){
			console.log(`Cache built! Found ${Object.keys(this.cache).length} packages in local repos`);
			console.log("");
		}

		//Create node_modules directory
		if (!fs.existsSync("./node_modules")){
			fs.mkdirSync("./node_modules");
		}

		//Gather packages and filter duplicates
		var pkgs = this._gatherPackages(packageNames);
		pkgs.found = this._filterDuplicates(pkgs.found);
		pkgs.missing = this._filterDuplicates(pkgs.missing);
		console.info("Packages needed for install found in local repos:", pkgs.found.reduce((str, pkg) => str + pkg.name + "\n", "\n"));
		console.warn("Packages needed for install missing from local repos:", pkgs.missing.reduce((str, pkg) => str + pkg + "\n", "\n"));

		//Install missing packages from npm
		var pkgsMissingCmd = pkgs.missing.reduce((cmd, pkg) => cmd + " " + pkg, "npm install --no-save") + "\n";
		if (!this.localOnly){
			console.log("Attempting to install missing packages from npm:");
			console.info(pkgsMissingCmd);
			execSync(pkgsMissingCmd, {
				stdio:"inherit"
			});
			console.log("Success!");
			console.log("");
		}

		//Install found packages locally
		var symlink = this.symlink;
		pkgs.found.forEach((pkg) => {
			//TODO: Add force flag to overwrite if exists?
			var packageName = pkg.name;
			var dst = "./node_modules/" + packageName;
			if (!fs.existsSync(dst)){
				console.log("Installing package:", packageName);
				if (symlink){
					fs.ensureSymlinkSync(pkg.fullPath, dst);
				} else {
					fs.copySync(pkg.fullPath, dst);
				}
				console.log("Success!");
				console.log("");
			}
		});

		//If missing packages not installed from npm show the command now
		if (this.localOnly){
			console.warn("You may need to install missing packages via npm:");
			console.info(pkgsMissingCmd);
		}

		return Promise.resolve(pkgs);
	}
	
	//Build a cache of packages found in repos
	async buildCache(){
		var repos = this.repoPaths;
		var cacheHash = crypto.createHash("md5").update(repos.reduce((concat, repo) => {
			concat += repo;
			return concat;
		}, "")).digest("hex");
		if (this.cacheHash == cacheHash){
			return Promise.resolve(false);
		}
		this.cacheHash = cacheHash;
		console.log("Building cache... (crawling repos for npm packages)", cacheHash);

		this.cache = {};
		var promises = repos.map((repo) => {
			return this._buildCache_enumerateDirectory(this.cache, repo);
		});
		await Promise.all(promises);
		return Promise.resolve(true);
	}
	
	//Search for packages in a directory and add them to cache
	_buildCache_enumerateDirectory(cache, dir, indent){
		indent = indent || "";
		if (this.verbose){
			indent += "  ";
			console.log(indent + dir);
		}

		return new Promise((resolve, reject) => {
			fs.readdir(dir, async (err, list) => {
				if (err) {
					reject(err);
					return;
				}
				var listLen = list.length;
				for (var i = 0; i < listLen; i++){
					var name = list[i];
					var fullPath = dir + '/' + name;
					try {
						var stat = fs.lstatSync(fullPath);
						if (stat.isDirectory()){
							//Recurse
							await this._buildCache_enumerateDirectory(cache, fullPath, indent);
						} else {
							try {
								//Found npm package
								if (name.toLowerCase() == "package.json"){
									var pkgJson = JSON.parse(fs.readFileSync(fullPath, "utf8"));
									var pkgName = pkgJson.name;
									if (cache.hasOwnProperty(pkgName)){
										if (this.verbose){
											console.warn("Package already exists in cache... skipping:", pkgName);
										}
									} else {
										cache[pkgName] = {
											name:pkgName,
											fullPath:dir,
											dependencies:pkgJson.dependencies || {},
											devDependencies:pkgJson.devDependencies || {}
										};
										if (this.verbose){
											console.info("Added package to cache:", pkgName);
										}
									}
								}
							} catch (err){
								console.warn("Error reading/parsing:", fullPath, err);
							}
						}
					} catch (err){
						reject(err);
						return;
					}
				}
				resolve(true);
			});
		});
	}
	
	//Checks if packageNames are in cache and finds dependencies
	//packageNames can be a string or array
	//Returns an object containing the found and missing packages
	_gatherPackages(packageNames){
		var pkgs = [];
		if (this._isArray(packageNames)){
			pkgs = packageNames;
		} else {
			pkgs.push(packageNames);
		}
		var packages = {
			found:[],
			missing:[]
		};
		var pkgsLen = pkgs.length;
		for (var i = 0; i < pkgsLen; i++){
			var packageName = pkgs[i];
			var pkg = this.cache[packageName];
			if (pkg){
				packages.found.push(pkg);
				var dependencies = Object.keys(pkg.dependencies);
				if (!this.production){
					dependencies = dependencies.concat(Object.keys(pkg.devDependencies));
				}
				//Recurse
				var recursePackages = this._gatherPackages(dependencies);
				packages.found = packages.found.concat(recursePackages.found);
				packages.missing = packages.missing.concat(recursePackages.missing);
			} else {
				packages.missing.push(packageName);
			}
		}
		return packages;
	}
	
	_isArray(arr){
		return arr && Object.prototype.toString.call(arr) === "[object Array]";
	}

	_filterDuplicates(arr){
		return arr.filter((v, i) => arr.indexOf(v) === i);
	}
}
NpmInstallOffline.ERROR_INVALID_PARAM = ERROR_INVALID_PARAM;

module.exports = NpmInstallOffline;