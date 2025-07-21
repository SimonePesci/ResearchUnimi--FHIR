const blockchainService = require("./blockchainService");
const axios = require("axios");
const cassandraClient = require("../config/cassandra");
const { PROXY_RE_ENCRYPTION_URL } = require("../config/constants");

exports.createUser = async (data) => {
  const { userType, address, name, surname, taxCode, userId } = data;

  // Create user on blockchain
  const userDetailsArray = await blockchainService.createUserOnBlockchain(
    userType,
    address,
    name,
    surname,
    taxCode
  );

  // Generate keys via Python service
  const publicKey = await generateKeys(userType, userId);

  const userDetails = {
    address: userDetailsArray[0],
    tokenID: userDetailsArray[1].toString(),
    name: userDetailsArray[2],
    surname: userDetailsArray[3],
    taxCode: userDetailsArray[4],
    publicKey,
  };

  return userDetails;
};

async function generateKeys(userType, userId) {
  const response = await axios.post(
    `${PROXY_RE_ENCRYPTION_URL}/generate_keys`,
    {
      user_type: userType,
      user_id: userId,
    }
  );

  const { public_key } = response.data;

  // Store the public key in Cassandra
  const query =
    userType === "patient"
      ? "INSERT INTO patient_keys (patient_id, public_key) VALUES (?, ?)"
      : "INSERT INTO doctor_keys (doctor_id, public_key) VALUES (?, ?)";

  await cassandraClient.execute(query, [userId, public_key], { prepare: true });

  return public_key;
}
