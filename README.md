# npm-install-offline
Installs node_modules from an offline copy or local repository

## Usage
Without global install:
```
npx npm-install-offline my-npm-package --repo ./my-offline-npm
```
With global install:
```
npm install -g npm-install-offline
npm-install-offline my-npm-package --repo ./my-offline-npm
```

## Options
- **--repo** packageDirectory1 packageDirectory2 | Specify directories to search for npm packages
- **--production** | Don't install devDependencies
- **--local-only** | Don't try to install missing packages from npm
- **--symlink** | Create symlinks instead of copying folders (requires elevated privileges)
- **--verbose** | Enable verbose logging

### Examples
- ```npm-install-offline packageDirectory```
- ```npm-install-offline packageName --repo repoDirectory```
- ```npm-install-offline packageName1 packageName2 packageDirectory1 --repo repoDirectory1 repoDirectory2```
- ```npm-install-offline [package] [--repo folder] [--production] [--local-only] [--symlink] [--verbose]```

#### Known issues
- There is a bug with npm (including v6.10.2) where if you run npm install it will uninstall packages not contained in package.json. This means if you use this tool to install local packages and then run npm install afterwards the local packages will get removed from your node_modules directory