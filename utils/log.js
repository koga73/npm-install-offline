//To log the boot message with a green background use:
//console.log(Log.COLORS.BG.GREEN, Log.MESSAGE.BOOT, Log.COLORS.SYSTEM.RESET);
module.exports = (function(){
	var _consts = {
		//Node console colors
		COLORS:{
			SYSTEM:{
				RESET:"\x1b[0m",
				BRIGHT:"\x1b[1m",
				DIM:"\x1b[2m",
				UNDERSCORE:"\x1b[4m",
				BLINK:"\x1b[5m",
				REVERSE:"\x1b[7m",
				HIDDEN:"\x1b[8m",
			},
			FG:{
				BLACK:"\x1b[30m",
				RED:"\x1b[31m",
				GREEN:"\x1b[32m",
				YELLOW:"\x1b[33m",
				BLUE:"\x1b[34m",
				MAGENTA:"\x1b[35m",
				CYAN:"\x1b[36m",
				WHITE:"\x1b[37m",
			},
			BG:{
				BLACK:"\x1b[40m",
				RED:"\x1b[41m",
				GREEN:"\x1b[42m",
				YELLOW:"\x1b[43m",
				BLUE:"\x1b[44m",
				MAGENTA:"\x1b[45m",
				CYAN:"\x1b[46m",
				WHITE:"\x1b[47m"
			}
		}
	};

	//Override console methods
	(function overrideConsole(){
		var consoleInfo = console.info;
		console.info = function(){
			var copyArgs = Array.prototype.slice.call(arguments);
			copyArgs.unshift("INFO:");
			copyArgs.unshift(_consts.COLORS.FG.CYAN);
			copyArgs.push(_consts.COLORS.SYSTEM.RESET);
			consoleInfo.apply(null, copyArgs);
		};

		var consoleLog = console.log;
		console.log = function(){
			var copyArgs = Array.prototype.slice.call(arguments);
			copyArgs.unshift(_consts.COLORS.SYSTEM.RESET);
			copyArgs.push(_consts.COLORS.SYSTEM.RESET);
			consoleLog.apply(null, copyArgs);
		};

		var consoleWarn = console.warn;
		console.warn = function(){
			var copyArgs = Array.prototype.slice.call(arguments);
			copyArgs.unshift("WARN:");
			copyArgs.unshift(_consts.COLORS.FG.YELLOW);
			copyArgs.push(_consts.COLORS.SYSTEM.RESET);
			consoleWarn.apply(null, copyArgs);
		};

		var consoleError = console.error;
		console.error = function(){
			var copyArgs = Array.prototype.slice.call(arguments);
			copyArgs.unshift("ERROR:");
			copyArgs.unshift(_consts.COLORS.FG.RED);
			copyArgs.push(_consts.COLORS.SYSTEM.RESET);
			consoleError.apply(null, copyArgs);
		};

		console.clear = function(){
			process.stdout.write('\x1Bc');
		};
	})();

	return {
		MESSAGE:_consts.MESSAGE,
		COLORS:_consts.COLORS
	};
})();