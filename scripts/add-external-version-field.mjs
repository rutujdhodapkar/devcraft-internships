// Add externalUpdateVersion field (default 0) to all user docs that lack it.
// Run: node scripts/add-external-version-field.mjs

async function migrate() {
  const { CosmosClient } = await import("@azure/cosmos");
  const connection = process.env.COSMOS_DB_CONNECTION_STRING;
  if (!connection) {
    console.error("Set COSMOS_DB_CONNECTION_STRING env var");
    process.exit(1);
  }
  const client = new CosmosClient(connection);
  const container = client.database("devcraft").container("main");

  let count = 0;
  const query = "SELECT * FROM c WHERE c.type = 'user' AND (NOT IS_DEFINED(c.externalUpdateVersion) OR c.externalUpdateVersion = null)";
  const { resources } = await container.items.query(query).fetchAll();

  for (const doc of resources) {
    doc.externalUpdateVersion = 0;
    await container.item(doc.id, doc.partitionKey || doc.id).replace(doc);
    count++;
    if (count % 50 === 0) console.log(`  ${count} updated...`);
  }

  console.log(`Done. ${count} user docs updated with externalUpdateVersion: 0`);
  process.exit(0);
}

migrate().catch(e => { console.error(e); process.exit(1); });
