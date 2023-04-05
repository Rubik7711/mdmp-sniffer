util = require("util")
dotenv = require("dotenv")
dotenv.config();
const events = require("events")
const fs = require("fs")
const ico = require('trayicon')
const steam = require("./util/steam.js")  
const path = require('path');
const client = require('filestack-js').init(process.env.FilestackAPI);
const WindowsBalloon = require('node-notifier').WindowsBalloon;
var ncp = require("copy-paste");
const ConsoleWindow = require("node-hide-console-window");

watchDir = steam.getGamePath(4000).game.path
processedDir = process.env.APPDATA + '\\MDMPSniffer' || (process.platform == 'darwin' ? process.env.HOME + '/Library/Preferences/MDMPSniffer' : process.env.HOME + "/.local/share/MDMPSniffer")
  
class Watcher extends events.EventEmitter {

    constructor(watchDir, processedDir) {
        super();
        this.watchDir = watchDir;
        this.processedDir = processedDir;
    }

    watch() {
        const watcher = this;
        fs.readdir(this.watchDir, function(err, files) {
            if (err) throw err;
            for (let index in files) {
                if (path.extname(files[index]) == ".mdmp") {
                    if (!fs.existsSync(processedDir + "/" + files[index].toLowerCase())) {
                        // TODO: don't copy to queue if the mdmp was uploaded already
                        watcher.emit("process", files[index]);
                        console.log("QUEUE:",files[index])
                    }
                }
            }
        });
    }

    start() {
        ConsoleWindow.hideConsole()
        var watcher = this;
        fs.watchFile( watchDir, function() { watcher.watch() } );
        ico.create(function(tray) {
            tray.setTitle('.MDMP Sniffer')
            // TODO: Change icon while upload is in progress 
            tray.setIcon(fs.readFileSync('./tit.ico'))
            // TODO: Display mdmps in queue
            let queue = tray.item("View Dumps", () => openExplorerin(processedDir) );
            //let tg = tray.item("Show Console", () =>  ConsoleWindow.showConsole());
            let quit = tray.item("Quit", () => process.exit(0) );
            tray.setMenu(queue,quit);
        });
    }
}
 
let watcher = new Watcher(watchDir, processedDir);
watcher.on("process", function process(file) {

    const watchFile = this.watchDir + "/" + file;
    const processedFile = this.processedDir + "/" + file.toLowerCase();

    fs.copyFile( watchFile, processedFile, function(err) { if (err) throw err } );

    client.upload(this.processedDir + "\\" + file.toLowerCase()).then(
        function(result){
            console.log(result);
            var notifier = new WindowsBalloon({withFallback: false});
            if (result.status == 'Stored') {
                notifier.notify(
                    {
                        title: "Garry's Mod Crash Detected",
                        message: 'Your crash dump has been logged and uploaded for review. You can click this notification to copy the download link.',
                        sound: true,
                        time: 16000,
                        wait: true,
                        type: 'warn'
                    },
                    function (error, response) {
                        if (response == 'activate') {
                            ncp.copy(result.url)
                        }
                    }
                );
            } else {
                notifier.notify(
                    {
                        title: "Garry's Mod Crash Detected",
                        message: 'We could not grab your crash dump. You can still send it to us. Click this notification to open your gmod folder and look for dump files',
                        sound: true,
                        time: 16000,
                        wait: true,
                        type: 'warn'
                    },
                    function (error, response) {
                        if (response == 'activate') {
                            openExplorerin(watchDir)
                        }
                    }
                );
            }
        },
        function(error){
            console.log(error);
        }
    );
});


if (watchDir) {
    if ( !fs.existsSync(processedDir) ) { fs.mkdirSync(processedDir) }
    watcher.start()
    console.log("Sniffing for juicy crash dumps [",watchDir + ' ]')
} else {
    console.error("ERROR: could not locate your Garry's Mod install")
    process.exit(1)
}

function openExplorerin(path, callback) {
    var cmd = ``;
    switch (require(`os`).platform().toLowerCase().replace(/[0-9]/g, ``).replace(`darwin`, `macos`)) {
        case `win`:
            path = path || '=';
            console.log(path)
            cmd = `explorer`;
            break;
        case `linux`:
            path = path || '/';
            cmd = `xdg-open`;
            break;
        case `macos`:
            path = path || '/';
            cmd = `open`;
            break;
    }
    let p = require(`child_process`).spawn(cmd, [path]);
    p.on('error', (err) => {
        p.kill();
        return callback(err);
    });
}
