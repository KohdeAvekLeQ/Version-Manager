# Version Manager
Version Manager is a Node version manager for PGSQL database.


## Configuration :
- Enter your database informations in the ```config.json``` file,
- Edit the link to the folder where the `.sql` files will be located if different
- Create a folder for every version in this format :
```
./00001 :
    -> up.sql
    -> down.sql
./00002 :
    -> up.sql
    -> down.sql
...
```
- Each folder must have the version it contains in its name, and 2 files, one to upgrade version, and one to downgrade version.

See an example of migration in the `./migrations` folder, with the `00000_base` folder.


## Usage :
Start the Version Manager by running `node main.js` or `npm start` in this folder, then enter the version you want in the console.


## Informations :
- If you apply the -1 version, all down files will be applied