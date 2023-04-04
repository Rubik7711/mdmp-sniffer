util = require("util")
const events = require("events")
const fs = require("fs")
const ico = require('trayicon')
const steam = require("./util/steam.js")  
const path = require('path');

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
        var watcher = this;
        fs.watchFile( watchDir, function() { watcher.watch() } );
        ico.create(function(tray) {
            tray.setTitle('.MDMP Sniffer')
            // TODO: Change icon while upload is in progress 
            tray.setIcon(fs.readFileSync('./tit.ico'))
            // TODO: Display mdmps in queue
            let queue = tray.item("View Dumps", () => openExplorerin(processedDir) );
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
    // TODO: Upload mdmps somewhere, dump queue once uploaded
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

// TODO: Toggle console 