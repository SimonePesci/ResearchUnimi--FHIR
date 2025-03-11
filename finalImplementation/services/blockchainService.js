const { hashPermissions } = require("../utils/helpers");
const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256"); // Ensure you have this package installed

/**
 * Creates a user on the blockchain.
 *
 * @param {Object} contracts - The initialized contract instances.
 * @param {string} userType - The type of user ("doctor", "assistant", "patient").
 * @param {string} address - The user's Ethereum address.
 * @param {string} name - The user's first name.
 * @param {string} surname - The user's last name.
 * @param {string} taxCode - The user's tax code.
 * @returns {Object} - The data of the created user.
 */
exports.createUserOnBlockchain = async (
  contracts,
  userType,
  address,
  name,
  surname,
  taxCode
) => {
  const { hospitalTokenContract, owner } = contracts;
  let data, data2;

  try {
    if (userType === "doctor") {
      data = await hospitalTokenContract.methods
        .mintDoctor(address, name, surname, taxCode)
        .send({ from: owner, gas: 5000000 });

      data2 = await hospitalTokenContract.methods
        .getLastMintedUser(1, address)
        .call();
    } else if (userType === "assistant") {
      data = await hospitalTokenContract.methods
        .mintAssistant(address, name, surname, taxCode)
        .send({ from: owner, gas: 5000000 });

      data2 = await hospitalTokenContract.methods
        .getLastMintedUser(3, address)
        .call();
    } else if (userType === "patient") {
      data = await hospitalTokenContract.methods
        .mintPatient(address, name, surname, taxCode)
        .send({ from: owner, gas: 5000000 });

      data2 = await hospitalTokenContract.methods
        .getLastMintedUser(2, address)
        .call();
    } else {
      throw new Error("Invalid user type provided.");
    }

    return data2;
  } catch (error) {
    console.error("Error creating user on blockchain:", error);
    throw error;
  }
};

/**
 * Sets hospital access for a user.
 *
 * @param {Object} contracts - The initialized contract instances.
 * @param {string} userType - The type of user ("doctor", "assistant", "patient").
 * @param {number} tokenID - The token ID of the user.
 * @param {number} hospitalID - The ID of the hospital.
 * @param {string} permissionsHash - The hash of the permissions.
 */
exports.setHospitalAccess = async (
  contracts,
  userType,
  tokenID,
  hospitalID,
  permissionsHash
) => {
  const { hospitalTokenContract, owner } = contracts;
  let user;

  try {
    // console.log(userType, "USER TYPE");

    // if (userType === "doctor") user = 1;
    // else if (userType === "patient") user = 2;
    // else if (userType === "assistant") user = 3;
    // else throw new Error("Invalid user type provided.");

    await hospitalTokenContract.methods
      .setHospitalAccess(user, tokenID, hospitalID, permissionsHash)
      .send({ from: owner, gas: 5000000 });

    console.log(`Hospital access set for user type: ${userType}`);
  } catch (error) {
    console.error("Error setting hospital access:", error);
    throw error;
  }
};

/**
 * Recomputes the Merkle Root from EMR data stored in Cassandra and updates the MerkleTree smart contract.
 *
 * @param {Object} contracts - The initialized contract instances.
 * @param {Object} cassandraClient - The initialized Cassandra client.
 * @returns {string} - The new Merkle Root in hexadecimal format.
 */
exports.updateMerkleRoot = async (contracts, cassandraClient) => {
  const { merkleTreeContract, owner } = contracts;

  try {
    // Step 1: Retrieve all EMR data from Cassandra
    const query = "SELECT data FROM fhir_resources";
    const result = await cassandraClient.execute(query);
    const EMRValuesArray = result.rows.map((row) => row.data);

    if (EMRValuesArray.length === 0) {
      throw new Error("No EMR records found in the database.");
    }

    console.log(`Total EMRs retrieved: ${EMRValuesArray.length}`);

    // Step 2: Create leaf nodes by hashing the EMR data
    const leafNodes = EMRValuesArray.map((EMR) => keccak256(EMR));

    // Step 3: Build the Merkle Tree
    const EMR_Tree = new MerkleTree(leafNodes, keccak256, { sortPairs: true });

    // Step 4: Get the new Merkle root
    const newMerkleRoot = EMR_Tree.getHexRoot();
    console.log("New Merkle Root:", newMerkleRoot);

    // Step 5: Update the Merkle Root in the smart contract
    const receipt = await merkleTreeContract.methods
      .updateMerkleRoot(newMerkleRoot)
      .send({ from: owner, gas: 500000 });

    console.log(
      "Merkle Root updated in smart contract. Transaction Hash:",
      receipt.transactionHash
    );

    return newMerkleRoot;
  } catch (error) {
    console.error("Error updating Merkle Root:", error);
    throw new Error("Failed to update Merkle Root.");
  }
};
