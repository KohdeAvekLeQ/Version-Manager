// Modules
const config = require('./config.json');
const fs = require('fs');

// PGSQL Client
const {Client} = require('pg');
let client= new Client({
    host: config.serverIP,
    user: config.defaultSQLUser,
    password: config.defaultSQLPassword,
    database: config.defaultSQLDatabase
});

// Get versions available in folder
function getVersions() {
    let files = fs.readdirSync(config.pathToFiles);
    
    return files.filter(file => !file.includes('.'));
};

// Get actual version in DB
function getActualVersion() {
    return new Promise((resolve, reject) => {
        client.query('SELECT * FROM __migrations ORDER BY version DESC', (err, res) => {
            if(err) {
                console.log(err);
                return reject('SQL error in getActualVersion');
            }
            
            if(res.rowCount > 0) {
                return resolve(res.rows[0].version);
            } else {
                return resolve(-1);
            }
        });
    });
}


// Apply SQL file to DB
function applySQLFile(data) {
    return new Promise((resolve, reject) => {
        client.query(data, (err, res) => {
            if (err) {
                console.error(err);
                return reject("SQL Error while applying file");
            }
            
            resolve();
        });
    });
}

// Apply a specific version
function applyVersion(vers) {
    // Get actual version in DB
    getActualVersion().then(async version => {
        // Versions available
        let dirs = getVersions();

        if(vers > version) { // New Version
            // Apply all new versions
            for(let v = version+1; v < vers+1; v++) {
                // Actual directory
                let dir = dirs[v];

                // Get sql file
                let files = fs.readdirSync(`${config.pathToFiles}/${dir}`).filter(file => file.startsWith('up') && file.endsWith('.sql'));

                // File exists
                if(files.length > 0) {
                    let file = files[0];

                    // Read file and query
                    let data = fs.readFileSync(`${config.pathToFiles}/${dir}/${file}`).toString();
                    await applySQLFile(data.toString()).catch((e) => {console.error(e);});

                    // Add version in DB
                    await applySQLFile(`INSERT INTO __migrations(version) VALUES (${v});`);

                    console.log(`Upgraded to V${v}`);
                } else {
                    console.log(`No migration UP file for version ${v}`);
                }
            }
        } else if(vers < version) { // Rollback to old version
            // Apply all old versions
            for(let v = version; v > vers; v--) {
                // Actual directory
                let dir = dirs[v];

                // Get sql file
                let files = fs.readdirSync(`${config.pathToFiles}/${dir}`).filter(file => file.startsWith('down') && file.endsWith('.sql'));

                // File exists
                if(files.length > 0) {
                    let file = files[0];

                    // Read file and query
                    let data = fs.readFileSync(`${config.pathToFiles}/${dir}/${file}`).toString();
                    await applySQLFile(data.toString());

                    // Add version in DB
                    await applySQLFile(`DELETE FROM __migrations WHERE version=${v}`);

                    console.log(`Downgraded to V${v-1}`);
                } else {
                    console.log(`No migration DOWN file for version ${v}`);
                }
            }
        } else { // Version already installed
            console.log('Version already installed');
        }

        process.exit();
    });
}



// Main function
async function main() {
    // Connect to client
    client.connect().then(async () => {
        // Create table migrations if not created
        await applySQLFile('CREATE TABLE IF NOT EXISTS __migrations (version SERIAL PRIMARY KEY)');

        let actV = await getActualVersion();
        let totalVer = getVersions();


        console.log('-------- VERSION MANAGER --------');
        console.log(`Actual Version : ${actV}`);
        console.log(`Max version available : ${totalVer.length - 1}\n\n`);
        console.log('Which version do you want to migrate to ?');


        // Waiting for data in input
        process.stdin.once('data', data => {
            if(isNaN(data)) {
                console.log('Enter a number !');
                process.exit();
            } else {
                let verMig = Number(data);
                
                // Check if exists
                if(verMig < -1) {
                    console.log('Enter a number > -1 !');
                    process.exit();
                } else if(verMig > totalVer.length - 1) {
                    console.log(`Version maximale : ${totalVer.length - 1}`);
                    process.exit();
                }

                // Change version
                applyVersion(verMig);
            }
        });
    }).catch((err) => {
        console.error(err);
    
        console.log('\n\nError while connecting to client, check your db informations in config.json');
        process.exit();
    });
}
main();