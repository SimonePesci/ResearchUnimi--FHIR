// services/permissionService.js
const cassandraClient = require("../config/cassandra");
const { hashPermissions } = require("../utils/helpers");
const keccak256 = require("keccak256"); // Import keccak256 for hashing

/**
 * Assigns permissions to a user on the blockchain and stores them off-chain.
 *
 * @param {Object} contracts - Contains initialized smart contract instances.
 * @param {Object} data - Contains userType, tokenID, hospitalID, and permissions.
 */
exports.assignPermission = async (contracts, data) => {
  const { userType, tokenID, hospitalID, permissions } = data;
  const { hospitalTokenContract, owner } = contracts;

  // Validate userType
  let tokenType;
  if (userType === "doctor") tokenType = 1;
  else if (userType === "patient") tokenType = 2;
  else if (userType === "assistant") tokenType = 3;
  else throw new Error("Invalid userType");

  const permissionsHash = hashPermissions(permissions);

  // Update permissions on blockchain
  await setHospitalAccess(
    hospitalTokenContract,
    owner,
    tokenType, // Pass numeric userType
    tokenID,
    hospitalID,
    permissionsHash
  );

  // Store permissions off-chain
  await storePermissionsOffChain(userType, tokenID, hospitalID, permissions);
};

/**
 * Sets hospital access on the blockchain by interacting with the smart contract.
 *
 * @param {Object} hospitalTokenContract - The initialized HospitalToken smart contract.
 * @param {string} owner - The owner address.
 * @param {number} tokenType - Numeric representation of userType.
 * @param {string} tokenID - The token ID of the user.
 * @param {string} hospitalID - The ID of the hospital.
 * @param {string} permissionsHash - The hash of the permissions.
 */
async function setHospitalAccess(
  hospitalTokenContract,
  owner,
  tokenType,
  tokenID,
  hospitalID,
  permissionsHash
) {
  if (!hospitalTokenContract || !hospitalTokenContract.methods) {
    throw new Error("HospitalToken contract is not initialized.");
  }

  await hospitalTokenContract.methods
    .setHospitalAccess(tokenType, tokenID, hospitalID, permissionsHash)
    .send({ from: owner, gas: 5000000 });
}

/**
 * Stores permissions in the Cassandra database.
 *
 * @param {string} userType - The string representation of the user type.
 * @param {string} tokenID - The token ID of the user.
 * @param {string} hospitalID - The ID of the hospital.
 * @param {Array<string>} permissions - Array of permissions.
 */
async function storePermissionsOffChain(
  userType,
  tokenID,
  hospitalID,
  permissions
) {
  const query = `
    INSERT INTO user_permissions (user_type, token_id, hospital_id, permissions)
    VALUES (?, ?, ?, ?)
  `;
  const params = [userType, tokenID, hospitalID, JSON.stringify(permissions)];
  await cassandraClient.execute(query, params, { prepare: true });
}

/**
 * Verifies if a user has specific permissions.
 *
 * @param {Object} contracts - Contains initialized smart contract instances.
 * @param {Object} query - Contains userType, tokenID, hospitalID, and permissions.
 * @returns {boolean} - Whether the user has the specified permissions.
 */
exports.verifyPermissions = async (contracts, query) => {
  const { userType, tokenID, hospitalID, permission } = query; // Changed 'permissions' to 'permission'
  const { hospitalTokenContract } = contracts;

  // Input Validation
  if (!permission) {
    throw new Error("Permission to check is not provided.");
  }

  // Convert userType to numeric tokenType
  let tokenType;
  if (userType === "doctor") tokenType = 1;
  else if (userType === "patient") tokenType = 2;
  else if (userType === "assistant") tokenType = 3;
  else throw new Error("Invalid userType");

  // Step 1: Retrieve permissions from off-chain storage (Cassandra)
  const offChainPermissions = await getPermissionsOffChain(
    userType,
    tokenID,
    hospitalID
  );

  if (!offChainPermissions) {
    console.error("No permissions found for the specified user.");
    throw new Error("No permissions found for the specified user.");
  }

  // Step 2: Hash the permissions
  const calculatedHash =
    "0x" + keccak256(JSON.stringify(offChainPermissions)).toString("hex");

  // Step 3: Retrieve the permissions hash from the blockchain
  const onChainHash = await hospitalTokenContract.methods
    .getHospitalPermissionsHash(tokenType, tokenID, hospitalID)
    .call();

  // Step 4: Compare the hashes
  if (calculatedHash !== onChainHash) {
    console.error("Permissions integrity check failed.");
    throw new Error("Permissions integrity check failed.");
  }

  // Step 5: Check if the specified permission is present
  const hasPermission = offChainPermissions.includes(permission);

  console.log(`User has permission '${permission}':`, hasPermission);

  return hasPermission;
};

/**
 * Helper function to retrieve permissions from Cassandra.
 *
 * @param {string} userType - The string representation of the user type.
 * @param {string} tokenID - The token ID of the user.
 * @param {string} hospitalID - The ID of the hospital.
 * @returns {Array<string> | null} - Array of permissions or null if not found.
 */
async function getPermissionsOffChain(userType, tokenID, hospitalID) {
  const query = `
      SELECT permissions
      FROM user_permissions
      WHERE user_type = ? AND token_id = ? AND hospital_id = ?
    `;
  const params = [userType, tokenID, hospitalID];
  const result = await cassandraClient.execute(query, params, {
    prepare: true,
  });

  if (result.rows.length === 0) {
    return null;
  }

  return JSON.parse(result.rows[0].permissions);
}
