# Version Manager
Version Manager is a Node version manager for PostgreSQL databases, inspired by Django's system.


## Configuration :
- Enter your database information in the `config.json` file,
- Edit the link to the folder where the `.sql` files will be located if different
- Create a folder for every version in this format, starting with 0000 :
```
./0000_name1 :
    -> up.sql
    -> down.sql
./0001_name2 :
    -> up.sql
    -> down.sql
...
```
- Each folder must contain 2 files, one to upgrade version, and one to downgrade version.

See an example of migration in the `./migrations` folder, with the `0000_base` folder.


## Usage :
Install the depandencies with `npm i`,\
Start the Version Manager by running `node main.js` or `npm start` in this folder, then enter the version you want in the console.


## Informations :
- If you apply the -1 version, all down files will be applied
- You can name your versions to recognize them, juste format them like this : `#####_name_of_version`
- By first running the program, it will create a `__migrations` table in your database, and the displayed version will be -1
- It may work with other types of SQL database, just edit the few SQL commands that might differ in the main.js file.
