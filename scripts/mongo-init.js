const database = db.getSiblingDB(process.env.MONGO_INITDB_DATABASE);
database.createUser({ user: process.env.MONGO_APP_USERNAME || "app_user", pwd: process.env.MONGO_APP_PASSWORD || "change_me", roles: [{ role: "readWrite", db: process.env.MONGO_INITDB_DATABASE }] });
