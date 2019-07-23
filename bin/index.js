#!/usr/bin/env node
const NpmInstallOffline = require("../npm-install-offline");

var args = process.argv.splice(2);
var options = parseArgs();
if (options){
	install(options);
}

function parseArgs(){
	var argsLen = args.length;
	if (argsLen){
		switch (args[0]){
			case "?":
			case "help":
				showCommands();
				return null;
		}
	} else {
		showCommands();
		return null;
	}

	var isRepo = false;
	var opts = {
		packageOrDirs:[],
		repos:[],
		production:false,
		localOnly:false,
		symlink:false,
		verbose:false
	};

	for (var i = 0; i < argsLen; i++){
		var arg = args[i];

		switch (arg){
			case "--repo":
				isRepo = true;
				break;

			case "--production":
				opts.production = true;
				break;

			case "--local-only":
				opts.localOnly = true;
				break;

			case "--symlink":
				opts.symlink = true;
				break;

			case "--verbose":
				opts.verbose = true;
				break;

			default:
				if (!isRepo){
					opts.packageOrDirs.push(arg);
				} else {
					opts.repos.push(arg);
				}
				break;
		}
	}
	return opts;
}

async function install(options){
	var npmInstallOffline = new NpmInstallOffline();
	npmInstallOffline.production = options.production;
	npmInstallOffline.localOnly = options.localOnly;
	npmInstallOffline.symlink = options.symlink;
	npmInstallOffline.verbose = options.verbose;

	options.repos.forEach((repo) => npmInstallOffline.addRepo(repo));
	var packages = options.packageOrDirs.map((packageOrDir) => npmInstallOffline.resolvePackage(packageOrDir));
	await npmInstallOffline.install(packages);

	console.log("");
	console.log("COMPLETE!");
}

function showCommands(){
	console.log("Usage examples:");
	console.log("    npm-install-offline packageDirectory");
	console.log("    npm-install-offline packageName --repo repoDirectory");
	console.log("    npm-install-offline packageName1 packageName2 packageDirectory1 --repo repoDirectory1 repoDirectory2");
	console.log("    npm-install-offline [package] [--repo folder] [--production] [--local-only] [--symlink] [--verbose]");
	console.log("");
	console.log("Options:");
	console.log("    --repo packageDirectory1 packageDirectory2 | Specify directories to search for npm packages");
	console.log("    --production | Don't install devDependencies");
	console.log("    --local-only | Don't try to install missing packages from npm");
	console.log("    --symlink | Create symlinks instead of copying folders (requires elevated privileges)");
	console.log("    --verbose | Enable verbose logging");
	console.log("");
}