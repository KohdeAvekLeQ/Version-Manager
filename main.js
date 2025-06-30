// Modules
const readline = require('node:readline/promises');
const {stdin, stdout} = require('node:process');
const {Client} = require('pg');
const fs = require('fs');

// Conf
const config = require('./config.json');

// DB CLIENT
let client = new Client({
    host: config.host,
    user: config.user,
    database: config.database,
    password: config.password,
    port: config.port,
    connectionTimeoutMillis: 3000
});

// Args
const args = process.argv.slice(2);

// Version check
function getVersions() {
    const dirsList = fs.readdirSync(config.pathToFiles, {withFileTypes: true}).filter((dir) => dir.isDirectory()).map((dir) => dir.name);
    dirsList.sort((a, b) => a.localeCompare(b, undefined, {numeric: true}));

    return dirsList;
}
function getActualVersion() {
    return new Promise((resolve, reject) => {
        client.query(
            'SELECT * FROM __migrations ORDER BY version DESC;',
            (err, res) => {
                if (err) {
                    console.log(err);
                    return reject('SQL error in getActualVersion');
                }

                if (res.rowCount > 0) {
                    return resolve(res.rows[0].version);
                } else {
                    return resolve(-1);
                }
            }
        );
    });
}

// Apply SQL
function applySQLFile(data) {
    return new Promise((resolve, reject) => {
        client.query(data, (err) => {
            if (err) {
                console.error(err);
                return reject('SQL Error in version update');
            }

            resolve();
        });
    });
}

// Apply version
async function applyVersion(vers) {
    // Get actual
    const version = await getActualVersion();
    let dirs = getVersions();

    // New Version
    if (vers > version) {
        // Begin SQL transaction
        await applySQLFile('BEGIN;');

        // Apply all new versions
        try {
            for (let v = version + 1; v < vers + 1; v++) {
                // Actual directory
                let dir = dirs[v];

                // Get sql file
                let files = fs
                    .readdirSync(`${config.pathToFiles}/${dir}`)
                    .filter(
                        (file) => file.startsWith('up') && file.endsWith('.sql')
                    );

                // File exists
                if (files.length > 0) {
                    let file = files[0];

                    // Read file and query
                    let data = fs
                        .readFileSync(`${config.pathToFiles}/${dir}/${file}`)
                        .toString();
                    await applySQLFile(data.toString()).catch((e) => {
                        console.error(e);
                    });

                    // Add version in DB
                    await applySQLFile(
                        `INSERT INTO __migrations(version) VALUES (${v});`
                    );

                    console.log(`Upgraded to V${v}`);
                } else {
                    console.log(`No migration UP file for version ${v}`);
                }
            }

            await applySQLFile('COMMIT;');
        } catch (error) {
            console.error(error);
            await applySQLFile('ROLLBACK;');
        }
    } else if (vers < version) {
        // Begin SQL transaction
        await applySQLFile('BEGIN;');

        // Apply all old versions
        try {
            for (let v = version; v > vers; v--) {
                // Actual directory
                let dir = dirs[v];

                // Get sql file
                let files = fs
                    .readdirSync(`${config.pathToFiles}/${dir}`)
                    .filter(
                        (file) =>
                            file.startsWith('down') && file.endsWith('.sql')
                    );

                // File exists
                if (files.length > 0) {
                    let file = files[0];

                    // Read file and query
                    let data = fs
                        .readFileSync(`${config.pathToFiles}/${dir}/${file}`)
                        .toString();
                    await applySQLFile(data.toString());

                    // Add version in DB
                    await applySQLFile(
                        `DELETE FROM __migrations WHERE version=${v}`
                    );

                    console.log(`Downgraded to V${v - 1}`);
                } else {
                    console.log(`No migration DOWN file for version ${v}`);
                }
            }

            await applySQLFile('COMMIT;');
        } catch (error) {
            console.error(error);
            await applySQLFile('ROLLBACK;');
        }
    } else {
        // Version already installed
        console.log('Version already installed');
    }

    process.exit();
}

// Main prog
async function main() {
    await client.connect().then(async () => {
        // Create table migrations if not created
        await applySQLFile(
            'CREATE TABLE IF NOT EXISTS __migrations (version SERIAL PRIMARY KEY);'
        );

        let actV = await getActualVersion();
        let totalVer = getVersions();

        console.log('-------- VERSION MANAGER --------');
        console.log(`Actual Version : ${actV}`);
        console.log(`Max version available : ${totalVer.length - 1}\n\n`);

        // If skip enabled
        if (
            actV === totalVer.length - 1 &&
            args.includes('--skip-if-last-version')
        ) {
            console.log('Last version already applied !');

            await client.end();
            process.exit();
        }

        // Init readline
        const rl = readline.createInterface({input: stdin, output: stdout});

        try {
            let versionNeeded = await rl.question(
                'Which version do you want to migrate to ? '
            );
            if (isNaN(versionNeeded)) {
                throw 'Enter a number !';
            }

            versionNeeded = Number(versionNeeded);

            // Check if exists
            if (versionNeeded < -1) {
                throw 'Enter a number > -1 !';
            } else if (versionNeeded > totalVer.length - 1) {
                throw `Maximum version : ${totalVer.length - 1}`;
            }

            // Change version
            await applyVersion(versionNeeded);
        } catch (error) {
            console.error('Error:', error);
            process.exit();
        } finally {
            rl.close();
            await client.end();
        }
    });
}
main();
