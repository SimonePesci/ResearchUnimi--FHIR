const { Client: CassandraClient } = require("cassandra-driver");
const cassandraClient = new CassandraClient({
  contactPoints: ["127.0.0.1:9042"],
  localDataCenter: "datacenter1",
  keyspace: "fhir_data",
});

cassandraClient
  .connect()
  .then(async () => {
    console.log("Connected to Cassandra");
    // await createCassandraTables();
  })
  .catch((err) => console.error("Cassandra connection error", err));

async function createCassandraTables() {
  await cassandraClient.execute(`
    CREATE TABLE IF NOT EXISTS fhir_resources (
      resource_id text PRIMARY KEY,
      resource_type text,
      version_id text,
      data text
    )
  `);

  await cassandraClient.execute(`
    CREATE TABLE IF NOT EXISTS user_permissions (
      user_type text,
      token_id text,
      hospital_id int,
      permissions text,
      PRIMARY KEY ((user_type, token_id), hospital_id)
    )
  `);

  await cassandraClient.execute(`
    CREATE TABLE IF NOT EXISTS patient_keys (
      patient_id text PRIMARY KEY,
      public_key text
    )
  `);

  await cassandraClient.execute(`
    CREATE TABLE IF NOT EXISTS doctor_keys (
      doctor_id text PRIMARY KEY,
      public_key text
    )
  `);

  console.log("Tables created");
}

module.exports = cassandraClient;
