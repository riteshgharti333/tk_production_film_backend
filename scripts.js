import { MongoClient } from 'mongodb';
 
// 1. Paste your connection strings here
const SOURCE_URI = "mongodb+srv://tkproductionfilmdata:tkproductionfilmdata@cluster0.snyql.mongodb.net/tkproductionfilmdata?retryWrites=true&w=majority&appName=Cluster";
const TARGET_URI = "mongodb+srv://riteshdb:riteshdb@cluster0.lcauzyl.mongodb.net/invoice?retryWrites=true&w=majority&appName=Cluster0";

async function migrateClusters() {
  const sourceClient = new MongoClient(SOURCE_URI);
  const targetClient = new MongoClient(TARGET_URI);

  try {
    console.log("Connecting to source and target clusters...");
    await Promise.all([sourceClient.connect(), targetClient.connect()]);
    console.log("Connected successfully!");

    const sourceAdmin = sourceClient.db().admin();
    
    // Get all databases on the source cluster
    const { databases } = await sourceAdmin.listDatabases();
    
    for (const dbInfo of databases) {
      const dbName = dbInfo.name;
      
      // Skip internal MongoDB system databases
      if (['admin', 'local', 'config'].includes(dbName)) continue;
      
      console.log(`\nStarting migration for database: [${dbName}]`);
      
      const sourceDb = sourceClient.db(dbName);
      const targetDb = targetClient.db(dbName);
      
      // Get all collections in this database
      const collections = await sourceDb.listCollections().toArray();
      
      for (const colInfo of collections) {
        const colName = colInfo.name;
        
        // Skip system indexes/collections
        if (colName.startsWith('system.')) continue;
        
        const sourceCol = sourceDb.collection(colName);
        const targetCol = targetDb.collection(colName);
        
        // Fetch all documents from the source collection
        const documents = await sourceCol.find({}).toArray();
        
        if (documents.length > 0) {
          console.log(` -> Copying ${documents.length} documents from collection: ${colName}`);
          
          // Optional: Clear target collection before inserting to prevent duplicate _id keys
          await targetCol.deleteMany({}); 
          
          // Insert data into the target cluster
          await targetCol.insertMany(documents);
        } else {
          console.log(` -> Collection ${colName} is empty. Skipping.`);
        }
      }
    }
    
    console.log("\n All cluster data has been successfully copied!");

  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    // Ensure both connections are cleanly closed
    await Promise.all([sourceClient.close(), targetClient.close()]);
    console.log("Connections closed.");
  }
}

migrateClusters();