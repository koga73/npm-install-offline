/*
* npm-install-offline v1.0.0 Copyright (c) 2019 AJ Savino
* https://github.com/koga73/npm-install-offline
* MIT LICENSE
*/
const fs = require("fs-extra");
const crypto = require("crypto");
const {exec, execSync} = require("child_process");

require("./utils/log");

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

	//Resolves parameter which can be a packageName or a directory
	resolvePackage(packageNameOrDir){
		console.log("Resolving packageName or directory:", packageNameOrDir);
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
				console.log("Resolved as directory:", packageNameOrDir);
				var pkgJson = fs.readFileSync(pkgDotJson, "utf8");
				var pkgName = JSON.parse(pkgJson).name;
				this.addRepo(packageNameOrDir);
				return pkgName;
			} else {
				throw new Error(ERROR_INVALID_PARAM);
			}
		}
		console.log("Resolved as packageName:", packageNameOrDir);
		return packageNameOrDir;
	}

	addRepo(repoPath){
		this.repoPaths.push(repoPath);
		var isDir = fs.lstatSync(repoPath).isDirectory();
		if (!isDir){
			throw new Error(ERROR_INVALID_PARAM);
		}
		console.log("Repo added:", repoPath);
	}

	//packageNames can be a string or array
	async install(packageNames, isRecurse){
		var pkgs = [];
		if (this.isArray(packageNames)){
			pkgs = packageNames;
		} else {
			pkgs.push(packageNames);
		}
		isRecurse = isRecurse === true;

		//Build cache
		var updatedCache = await this.buildCache();
		if (updatedCache){
			console.log(`Cache built! Found ${Object.keys(this.cache).length} packages`);
			console.log("");
		}

		//Create node_modules directory
		if (!fs.existsSync("./node_modules")){
			fs.mkdirSync("./node_modules");
		}
		var pkgsMissing = [];

		var pkgsLen = pkgs.length;
		for (var i = 0; i < pkgsLen; i++){
			var packageName = pkgs[i];
			var pkg = this.cache[packageName];
			if (pkg){
				var dst = "./node_modules/" + pkg.name;
				//TODO: Add force flag to overwrite if exists?
				if (!fs.existsSync(dst)){
					console.log("Installing package:", packageName);
					if (this.symlink){
						fs.ensureSymlinkSync(pkg.fullPath, dst);
					} else {
						fs.copySync(pkg.fullPath, dst);
					}
					console.log("Success!");
					console.log("");
				}

				var dependencies = Object.keys(pkg.dependencies);
				if (!this.production){
					dependencies = dependencies.concat(Object.keys(pkg.devDependencies));
				}
				//Recurse
				pkgsMissing = pkgsMissing.concat(await this.install(dependencies, true));
			} else {
				pkgsMissing.push(packageName);
			}
		}

		if (!isRecurse){
			//Remove duplicates
			pkgsMissing = pkgsMissing.filter((pkgName, index) => pkgsMissing.indexOf(pkgName) === index);

			console.log("Packges not found in local repos:", pkgsMissing.reduce((str, pkg) => str + pkg + "\n", "\n"));

			var pkgsMissingCmd = pkgsMissing.reduce((cmd, pkg) => cmd + " " + pkg, "npm install --no-save") + "\n";
			if (!this.localOnly){
				console.info("Attempting to install missing packages from npm:");
				console.info(pkgsMissingCmd);
				execSync(pkgsMissingCmd, {
					stdio:"inherit"
				});
				console.log("Success!");
			} else {
				console.warn("You may need to install missing packages via npm:");
				console.info(pkgsMissingCmd);
			}
		}

		return Promise.resolve(pkgsMissing);
	}

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
			return this.buildCache_enumerateDirectory(this.cache, repo);
		});
		await Promise.all(promises);
		return Promise.resolve(true);
	}

	buildCache_enumerateDirectory(cache, dir, indent){
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
							await this.buildCache_enumerateDirectory(cache, fullPath, indent);
						} else {
							try {
								//Found npm package
								if (name.toLowerCase() == "package.json"){
									var pkgJson = JSON.parse(fs.readFileSync(fullPath, "utf8"));
									var pkgName = pkgJson.name;
									if (cache.hasOwnProperty(pkgName)){
										console.warn("Package already exists in cache... skipping:", pkgName);
									} else {
										cache[pkgName] = {
											name:pkgName,
											fullPath:dir,
											dependencies:pkgJson.dependencies || {},
											devDependencies:pkgJson.devDependencies || {}
										};
										console.log("Added package to cache:", pkgName);
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

	isArray(arr){
		return arr && Object.prototype.toString.call(arr) === "[object Array]";
	}
}
NpmInstallOffline.ERROR_INVALID_PARAM = ERROR_INVALID_PARAM;

module.exports = NpmInstallOffline;